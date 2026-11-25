#!/usr/bin/env node
/**
 * Creates (or repairs) IMS logins through the Supabase Admin API.
 *
 *   npm run setup:users              admin account only
 *   npm run setup:users -- --demo    also one demo user per role (manager, operator, viewer)
 *
 * Reads from `.env` (git-ignored):
 *   SUPABASE_URL          your project URL
 *   SUPABASE_SECRET_KEY   Project Settings → API Keys → secret key (sb_secret_…) or legacy service_role.
 *                         Local use only – never put it in the app. Safe to delete afterwards.
 *   ADMIN_EMAIL           your login
 *   ADMIN_PASSWORD        password to set (min 8 chars)
 *   DEMO_PASSWORD         optional, password for --demo users (defaults to ADMIN_PASSWORD)
 *
 * Existing users keep their id; their password is reset, email confirmed and profile updated.
 */
import { createClient } from '@supabase/supabase-js';
import { existsSync } from 'node:fs';

if (existsSync('.env')) process.loadEnvFile('.env');

const url = (process.env.SUPABASE_URL ?? '').trim().replace(/\/+$/, '');
const secretKey = (process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY ?? '').trim();
const adminEmail = (process.env.ADMIN_EMAIL ?? '').trim().toLowerCase();
const adminPassword = process.env.ADMIN_PASSWORD ?? '';
const demoPassword = process.env.DEMO_PASSWORD || adminPassword;
const withDemo = process.argv.includes('--demo');

const ok = (msg) => console.log(`  \x1b[32m✔\x1b[0m ${msg}`);
const die = (msg) => {
  console.error(`  \x1b[31m✘\x1b[0m ${msg}`);
  process.exit(1);
};

const missing = [
  !url && 'SUPABASE_URL',
  !secretKey && 'SUPABASE_SECRET_KEY',
  !adminEmail && 'ADMIN_EMAIL',
  !adminPassword && 'ADMIN_PASSWORD',
].filter(Boolean);
if (missing.length) die(`Add ${missing.join(', ')} to .env (see .env.example).`);
if (secretKey.startsWith('sb_publishable_')) die('SUPABASE_SECRET_KEY is the publishable key – use the secret key.');
if (adminPassword.length < 8) die('ADMIN_PASSWORD must be at least 8 characters.');

const supabase = createClient(url, secretKey, { auth: { persistSession: false, autoRefreshToken: false } });

/** Every auth user, across pages. */
async function listAllUsers() {
  const users = [];
  for (let page = 1; ; page++) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) die(`Cannot list users (${error.message}). Is SUPABASE_SECRET_KEY the secret/service_role key?`);
    users.push(...data.users);
    if (data.users.length < 1000) return users;
  }
}

async function upsertUser(existing, { email, password, fullName, title, role, siteIds }) {
  const found = existing.find((u) => u.email?.toLowerCase() === email);
  let id;
  if (found) {
    const { error } = await supabase.auth.admin.updateUserById(found.id, {
      password,
      email_confirm: true,
      ban_duration: 'none',
      user_metadata: { full_name: fullName },
    });
    if (error) die(`${email}: ${error.message}`);
    id = found.id;
  } else {
    const { data, error } = await supabase.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName },
    });
    if (error) die(`${email}: ${error.message}`);
    id = data.user.id;
  }

  // Secret key bypasses RLS: set role + site access directly.
  const { error: profileError } = await supabase
    .from('profiles')
    .upsert({ id, full_name: fullName, title, role, site_ids: siteIds }, { onConflict: 'id' });
  if (profileError) {
    const hint = profileError.code === 'PGRST205' || profileError.code === '42P01'
      ? ' – run supabase/fresh_setup.sql first'
      : '';
    die(`${email}: profile update failed (${profileError.message})${hint}`);
  }
  ok(`${found ? 'Updated' : 'Created'} ${email}  →  ${role}, sites ${JSON.stringify(siteIds)}`);
}

console.log(`\n\x1b[1mIMS users · ${url}\x1b[0m`);
const existing = await listAllUsers();

await upsertUser(existing, {
  email: adminEmail,
  password: adminPassword,
  fullName: 'Administrator',
  title: 'Administrator',
  role: 'admin',
  siteIds: ['*'],
});

if (withDemo) {
  const domain = adminEmail.split('@')[1] ?? 'example.com';
  const demo = [
    { local: 'manager', fullName: 'Demo Manager', title: 'Operations Manager', role: 'manager', siteIds: ['*'] },
    { local: 'operator', fullName: 'Demo Operator', title: 'Warehouse Operator · Rotterdam & Nairobi', role: 'operator', siteIds: ['rtm', 'nbo'] },
    { local: 'viewer', fullName: 'Demo Auditor', title: 'Auditor (read-only)', role: 'viewer', siteIds: ['*'] },
  ];
  for (const d of demo) {
    await upsertUser(existing, { ...d, email: `ims.${d.local}@${domain}`, password: demoPassword });
  }
}

console.log(`\n  Sign in at http://localhost:4200 with ${adminEmail} and your ADMIN_PASSWORD.`);
console.log('  Tip: remove SUPABASE_SECRET_KEY from .env when you no longer need this script.\n');
