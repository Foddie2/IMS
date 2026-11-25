import { isPlatformBrowser } from '@angular/common';
import { DestroyRef, PLATFORM_ID, Service, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import type { Session } from '@supabase/supabase-js';
import { catchError, from, map, of, timeout } from 'rxjs';
import { AppUser, AuthSource, Permission, ROLE_PERMISSIONS, Role } from '../models/auth.models';
import { ProfileRow } from '../models/supabase.models';
import { initialsOf, mapProfile } from '../utils/auth.mapper';
import { STORAGE_KEYS, readStorage, writeStorage } from '../utils/browser-storage';
import { SupabaseService } from './supabase.service';

/** Demo personas – used only when Supabase is not configured (sample-data mode). */
export const DEMO_USERS: Record<Role, AppUser> = {
  admin: { id: 'demo-admin', name: 'Alex Morgan', title: 'Administrator', role: 'admin', siteIds: ['*'] },
  manager: { id: 'demo-manager', name: 'Priya Raman', title: 'Operations Manager', role: 'manager', siteIds: ['*'] },
  operator: {
    id: 'demo-operator',
    name: 'Daniel Okoye',
    title: 'Warehouse Operator · Rotterdam & Nairobi',
    role: 'operator',
    siteIds: ['rtm', 'nbo'],
  },
  viewer: { id: 'demo-viewer', name: 'Sam Lindqvist', title: 'Auditor (read-only)', role: 'viewer', siteIds: ['*'] },
};

function isRole(value: string | null): value is Role {
  return value !== null && value in DEMO_USERS;
}

/**
 * Session, current user and permission checks.
 *
 * Supabase mode: email/password sign-in via Supabase Auth; role and site access come from
 * the `profiles` table (and are enforced again in the database by row-level security).
 * Demo mode (Supabase not configured): switchable demo personas, no sign-in.
 */
@Service()
export class AuthService {
  private readonly supabase = inject(SupabaseService);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  readonly source: AuthSource = this.supabase.isConfigured ? 'supabase' : 'demo';

  private readonly demoRole = signal<Role>('admin');
  readonly session = signal<Session | null>(null);
  /** True once the stored session (if any) has been restored. Always true on the server / in demo mode. */
  readonly ready = signal(this.source === 'demo' || !this.isBrowser);

  readonly isAuthenticated = computed(() => this.source === 'demo' || this.session() !== null);
  readonly userId = computed(() => this.session()?.user.id ?? null);
  readonly email = computed(() => this.session()?.user.email ?? '');

  private readonly profile = rxResource<AppUser | null, string | undefined>({
    params: () => this.userId() ?? undefined,
    stream: ({ params: userId }) =>
      from(this.fetchProfile(userId)).pipe(
        timeout(this.supabase.timeoutMs),
        map((row) => (row ? mapProfile(row, this.email()) : null)),
        catchError(() => of(null)),
      ),
    defaultValue: null,
  });

  /** True while a signed-in user's profile is still loading. */
  readonly profileLoading = computed(() => this.source === 'supabase' && this.profile.isLoading());

  /** Session restored and (if signed in) role/site access known – safe to evaluate permissions. */
  readonly accessReady = computed(() => {
    if (!this.ready()) return false;
    if (this.source === 'demo' || !this.userId()) return true;
    const status = this.profile.status();
    return status === 'resolved' || status === 'error' || status === 'local';
  });

  readonly user = computed<AppUser>(() => {
    if (this.source === 'demo') return DEMO_USERS[this.demoRole()];
    // Until (or unless) a profile row is readable, grant nothing: operator with no sites.
    return (
      this.profile.value() ?? {
        id: this.userId() ?? 'anonymous',
        name: this.email() || 'Signed out',
        title: 'No role assigned',
        role: 'operator',
        siteIds: [],
      }
    );
  });

  readonly initials = computed(() => initialsOf(this.user().name));
  readonly permissions = computed<ReadonlySet<Permission>>(() => new Set(ROLE_PERMISSIONS[this.user().role]));
  readonly demoUsers = Object.values(DEMO_USERS);

  constructor() {
    if (!this.isBrowser) return;

    if (this.source === 'demo') {
      const stored = readStorage(STORAGE_KEYS.demoRole);
      if (isRole(stored)) this.demoRole.set(stored);
      return;
    }

    const destroyRef = inject(DestroyRef);
    void this.supabase.client().then(async (client) => {
      const { data } = await client.auth.getSession();
      this.session.set(data.session);
      this.ready.set(true);
      const { data: listener } = client.auth.onAuthStateChange((_event, session) => this.session.set(session));
      destroyRef.onDestroy(() => listener.subscription.unsubscribe());
    }).catch(() => this.ready.set(true));
  }

  can(permission: Permission): boolean {
    return this.permissions().has(permission);
  }

  /** Returns an error message, or `null` on success. */
  async signIn(email: string, password: string): Promise<string | null> {
    try {
      const client = await this.supabase.client();
      const { data, error } = await client.auth.signInWithPassword({ email, password });
      if (error) return error.message;
      this.session.set(data.session);
      return null;
    } catch {
      return 'Could not reach the sign-in service. Check your connection and try again.';
    }
  }

  async signOut(): Promise<void> {
    if (this.source === 'demo') return;
    const client = await this.supabase.client();
    await client.auth.signOut();
    this.session.set(null);
  }

  /** Switch persona (demo mode only). */
  switchDemoRole(role: Role): void {
    this.demoRole.set(role);
    writeStorage(STORAGE_KEYS.demoRole, role);
  }

  private async fetchProfile(userId: string): Promise<ProfileRow | null> {
    const client = await this.supabase.client();
    const { data, error } = await client
      .from('profiles')
      .select('id, full_name, title, role, site_ids')
      .eq('id', userId)
      .maybeSingle();
    if (error) throw error;
    return data as ProfileRow | null;
  }
}
