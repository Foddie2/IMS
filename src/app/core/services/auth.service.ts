import { isPlatformBrowser } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { DestroyRef, PLATFORM_ID, Service, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { LoginResponse, Role, UserDto } from '../models/api.models';
import { AppUser, Permission, ROLE_PERMISSIONS } from '../models/auth.models';
import { initialsOf, mapUser, tokenExpiry } from '../utils/auth.mapper';
import { STORAGE_KEYS, readStorage, removeStorage, writeStorage } from '../utils/browser-storage';
import { apiErrorMessage } from '../utils/api-error';

interface StoredSession {
  token: string;
  expiresAt: number;
  user: UserDto;
}

const SIGNED_OUT_USER: AppUser = { id: 0, name: 'Signed out', email: '', title: '', role: 'User', siteIds: [] };

/**
 * JWT session against the IMS API.
 *
 * The token and the user profile live in signals (and localStorage so a reload keeps you signed in).
 * The token is never trusted for authorization in the UI beyond hiding actions – the API re-checks
 * every request. On startup the stored profile is refreshed from `GET /auth/me`.
 */
@Service()
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly isBrowser = isPlatformBrowser(inject(PLATFORM_ID));
  private expiryTimer: ReturnType<typeof setTimeout> | undefined;

  private readonly session = signal<StoredSession | null>(null);

  readonly token = computed(() => this.session()?.token ?? null);
  readonly isAuthenticated = computed(() => this.session() !== null);
  readonly user = computed<AppUser>(() => {
    const user = this.session()?.user;
    return user ? mapUser(user) : SIGNED_OUT_USER;
  });
  readonly userId = computed(() => this.session()?.user.id ?? null);
  readonly role = computed(() => this.session()?.user.role ?? null);
  readonly email = computed(() => this.session()?.user.email ?? '');
  readonly initials = computed(() => initialsOf(this.user().name));
  readonly permissions = computed<ReadonlySet<Permission>>(() =>
    this.isAuthenticated() ? new Set(ROLE_PERMISSIONS[this.user().role]) : new Set(),
  );

  constructor() {
    if (!this.isBrowser) return;
    inject(DestroyRef).onDestroy(() => clearTimeout(this.expiryTimer));

    const stored = this.readStoredSession();
    if (stored) {
      this.setSession(stored);
      void this.refreshProfile();
    }
  }

  /** True when the signed-in user has one of the given roles. */
  hasRole(roles: readonly Role[]): boolean {
    const role = this.role();
    return role !== null && roles.includes(role);
  }

  can(permission: Permission): boolean {
    return this.permissions().has(permission);
  }

  /** Returns an error message for the form, or `null` on success. */
  async login(email: string, password: string): Promise<string | null> {
    try {
      const response = await firstValueFrom(
        this.http.post<LoginResponse>(`${environment.apiUrl}/auth/login`, { email, password }),
      );
      const expiresAt = tokenExpiry(response.accessToken) ?? Date.parse(response.expiresAt);
      this.setSession({ token: response.accessToken, expiresAt, user: response.user });
      return null;
    } catch (error) {
      return apiErrorMessage(error, 'Sign-in failed.');
    }
  }

  /** Clears the session. With `redirect`, goes to /login and remembers where the user was. */
  logout(options: { redirect?: boolean; returnUrl?: string } = {}): void {
    clearTimeout(this.expiryTimer);
    this.session.set(null);
    removeStorage(STORAGE_KEYS.session);
    if (options.redirect) {
      const returnUrl = options.returnUrl ?? this.router.url;
      void this.router.navigate(['/login'], {
        queryParams: returnUrl && !returnUrl.startsWith('/login') ? { returnUrl } : {},
      });
    }
  }

  /** Re-reads role and warehouse assignments (they may have changed since sign-in). */
  async refreshProfile(): Promise<void> {
    const current = this.session();
    if (!current) return;
    try {
      const user = await firstValueFrom(this.http.get<UserDto>(`${environment.apiUrl}/auth/me`));
      if (this.session()?.token === current.token) {
        this.setSession({ ...current, user });
      }
    } catch {
      // 401 is handled by the interceptor (logout); network errors keep the cached profile.
    }
  }

  private setSession(session: StoredSession): void {
    this.session.set(session);
    writeStorage(STORAGE_KEYS.session, JSON.stringify(session));

    clearTimeout(this.expiryTimer);
    const remaining = session.expiresAt - Date.now();
    // setTimeout overflows above ~24.8 days; tokens are much shorter than that.
    this.expiryTimer = setTimeout(() => this.logout({ redirect: true }), Math.min(remaining, 2_147_000_000));
  }

  private readStoredSession(): StoredSession | null {
    const raw = readStorage(STORAGE_KEYS.session);
    if (!raw) return null;
    try {
      const session = JSON.parse(raw) as StoredSession;
      const valid = typeof session.token === 'string' && session.user && session.expiresAt > Date.now() + 5_000;
      if (!valid) removeStorage(STORAGE_KEYS.session);
      return valid ? session : null;
    } catch {
      removeStorage(STORAGE_KEYS.session);
      return null;
    }
  }
}
