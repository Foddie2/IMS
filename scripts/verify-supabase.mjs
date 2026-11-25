#!/usr/bin/env node
/**
 * End-to-end check of the Supabase setup.
 *
 *   npm run verify:supabase            read-only checks
 *   npm run verify:supabase -- --write also changes one stock quantity by +1 and back,
 *                                      to prove writes, the activity trigger and Realtime
 *
 * Reads SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY and (optionally) TEST_EMAIL / TEST_PASSWORD
 * from `.env` (git-ignored).
 */
import { createClient } from '@supabase/supabase-js';
import { existsSync } from 'node:fs';

const WRITE = process.argv.includes('--write');
const TABLES = ['sites', 'categories', 'products', 'stock_levels', 'activity_events', 'profiles'];
let failures = 0;

const ok = (msg) => console.log(`  \x1b[32m✔\x1b[0m ${msg}`);
const warn = (msg) => console.log(`  \x1b[33m!\x1b[0m ${msg}`);
const fail = (msg) => {
  failures++;
  console.log(`  \x1b[31m✘\x1b[0m ${msg}`);
};
const section = (title) => console.log(`\n\x1b[1m${title}\x1b[0m`);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------- config
section('1. Configuration');
if (existsSync('.env')) process.loadEnvFile('.env');
const url = (process.env.SUPABASE_URL ?? '').trim().replace(/\/+$/, '');
const anonKey = (process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? '').trim();
const TEST_EMAIL = process.env.TEST_EMAIL || process.env.ADMIN_EMAIL || '';
const TEST_PASSWORD = process.env.TEST_PASSWORD || process.env.ADMIN_PASSWORD || '';

if (!url || !anonKey) {
  fail('Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY in .env (see .env.example)');
  process.exit(1);
}
ok(`Project URL: ${url}`);
if (/service_role/.test(Buffer.from(anonKey.split('.')[1] ?? '', 'base64').toString()) || anonKey.startsWith('sb_secret_')) {
  fail('That is a SECRET/service_role key – it must never be in the frontend. Use the publishable (anon) key.');
  process.exit(1);
}
ok('Key is a publishable (anon) key');

const supabase = createClient(url, anonKey, { auth: { persistSession: false } });

// ---------------------------------------------------------------- anonymous
section('2. Schema + row-level security (signed out)');
for (const table of TABLES) {
  const { data, error } = await supabase.from(table).select('*').limit(1);
  if (error) {
    const missing = error.code === 'PGRST205' || error.code === '42P01';
    fail(`${table}: ${missing ? 'table missing – run supabase/migrations/0001_inventory_schema.sql' : error.message}`);
  } else if (data.length > 0) {
    fail(`${table}: readable without signing in – RLS is not enabled on this table!`);
  } else {
    ok(`${table}: exists, hidden from anonymous users`);
  }
}

// ---------------------------------------------------------------- signed in
section('3. Signed-in access');
if (!TEST_EMAIL || !TEST_PASSWORD) {
  warn('Skipped: add ADMIN_EMAIL/ADMIN_PASSWORD (or TEST_EMAIL/TEST_PASSWORD) to .env to test sign-in, data and Realtime.');
} else {
  const { data: auth, error: authError } = await supabase.auth.signInWithPassword({
    email: TEST_EMAIL,
    password: TEST_PASSWORD,
  });
  if (authError) {
    fail(`Sign-in failed: ${authError.message}`);
  } else {
    ok(`Signed in as ${auth.user.email}`);

    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, site_ids, full_name')
      .eq('id', auth.user.id)
      .maybeSingle();
    if (profileError || !profile) {
      fail(`No profile row: ${profileError?.message ?? 'missing (did the migration run before this user was created?)'}`);
    } else {
      ok(`Profile: role=${profile.role}, sites=${JSON.stringify(profile.site_ids)}`);
      if (profile.role === 'operator' && profile.site_ids.length === 0) {
        warn('This user has no sites yet – run supabase/bootstrap_admin.sql (or assign sites) to see data.');
      }
    }

    const counts = {};
    for (const table of ['sites', 'categories', 'products', 'stock_levels', 'activity_events']) {
      const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
      if (error) fail(`${table}: ${error.message}`);
      else counts[table] = count ?? 0;
    }
    ok(`Visible rows: ${Object.entries(counts).map(([t, c]) => `${t}=${c}`).join(', ')}`);
    if (counts.products === 0) warn('No products – run supabase/seed.sql for demo data.');

    // Realtime subscription
    const events = [];
    const channel = supabase
      .channel('verify-script')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'stock_levels' }, (p) => events.push(p))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'activity_events' }, (p) => events.push(p));
    const status = await new Promise((resolve) => {
      const timer = setTimeout(() => resolve('TIMED_OUT'), 10_000);
      channel.subscribe((s) => {
        if (s !== 'SUBSCRIBED' && s !== 'CHANNEL_ERROR' && s !== 'TIMED_OUT') return;
        clearTimeout(timer);
        resolve(s);
      });
    });
    if (status === 'SUBSCRIBED') ok('Realtime channel subscribed');
    else fail(`Realtime: ${status} (is the publication set up? re-run the last line of the migration)`);

    // Optional write round-trip
    if (WRITE) {
      section('4. Write round-trip (--write)');
      const { data: row, error } = await supabase
        .from('stock_levels')
        .select('product_id, site_id, quantity')
        .limit(1)
        .maybeSingle();
      if (error || !row) {
        fail(`No stock row to test with: ${error?.message ?? 'none visible'}`);
      } else {
        const where = (q) => q.eq('product_id', row.product_id).eq('site_id', row.site_id);
        const up = await where(supabase.from('stock_levels').update({ quantity: row.quantity + 1 }));
        if (up.error) {
          fail(`Update denied: ${up.error.message} (viewers are read-only by design)`);
        } else {
          await sleep(2500);
          const realtimeSeen = events.some((e) => e.table === 'stock_levels');
          const activitySeen = events.some((e) => e.table === 'activity_events');
          realtimeSeen ? ok('Realtime delivered the stock change') : fail('No Realtime event for the stock change');
          activitySeen ? ok('Trigger wrote an activity event') : warn('No activity event seen via Realtime');
          const down = await where(supabase.from('stock_levels').update({ quantity: row.quantity }));
          down.error ? fail(`Could not restore quantity: ${down.error.message}`) : ok(`Restored quantity to ${row.quantity}`);
        }
      }
    }

    await supabase.removeChannel(channel);
    await supabase.auth.signOut();
  }
}

console.log(failures ? `\n\x1b[31m${failures} check(s) failed.\x1b[0m` : '\n\x1b[32mAll checks passed.\x1b[0m');
process.exit(failures ? 1 : 0);
