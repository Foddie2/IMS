import { isPlatformBrowser } from '@angular/common';
import { PLATFORM_ID, Service, computed, inject, signal } from '@angular/core';
import { rxResource } from '@angular/core/rxjs-interop';
import { catchError, forkJoin, map, of, timeout } from 'rxjs';
import { AppUser, AuthSource, Permission, ROLE_PERMISSIONS, Role } from '../models/auth.models';
import { initialsOf, mapInvenTreeUser } from '../utils/auth.mapper';
import { STORAGE_KEYS, readStorage, writeStorage } from '../utils/browser-storage';
import { InvenTreeApiService } from './inventree-api.service';
import { INVENTREE_CONFIG } from './inventree.config';

/** Demo personas so clients can preview every role without an InvenTree account. */
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
 * Current user + permission checks.
 *
 * With an InvenTree API token configured, the user and their rulesets are read from
 * `/api/user/me/` and `/api/user/roles/`. Otherwise (or on failure) a demo persona is
 * used, switchable from the account menu.
 */
@Service()
export class AuthService {
  private readonly api = inject(InvenTreeApiService);
  private readonly config = inject(INVENTREE_CONFIG);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));

  private readonly demoRole = signal<Role>('admin');

  private readonly liveUser = rxResource<AppUser | null, true | undefined>({
    params: () => (this.isBrowser && this.api.hasToken ? true : undefined),
    stream: () =>
      forkJoin({ user: this.api.getCurrentUser(), roles: this.api.getUserRoles() }).pipe(
        timeout(this.config.timeoutMs),
        map(({ user, roles }) => mapInvenTreeUser(user, roles)),
        catchError(() => of(null)),
      ),
    defaultValue: null,
  });

  readonly source = computed<AuthSource>(() => (this.liveUser.value() ? 'inventree' : 'demo'));
  readonly user = computed<AppUser>(() => this.liveUser.value() ?? DEMO_USERS[this.demoRole()]);
  readonly initials = computed(() => initialsOf(this.user().name));
  readonly permissions = computed<ReadonlySet<Permission>>(() => new Set(ROLE_PERMISSIONS[this.user().role]));
  readonly demoUsers = Object.values(DEMO_USERS);

  constructor() {
    if (this.isBrowser) {
      const stored = readStorage(STORAGE_KEYS.demoRole);
      if (isRole(stored)) this.demoRole.set(stored);
    }
  }

  can(permission: Permission): boolean {
    return this.permissions().has(permission);
  }

  /** Switch persona (demo mode only). */
  switchDemoRole(role: Role): void {
    this.demoRole.set(role);
    writeStorage(STORAGE_KEYS.demoRole, role);
  }
}
