import { isPlatformServer } from '@angular/common';
import { PLATFORM_ID, inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { CanActivateFn, Router } from '@angular/router';
import { filter, map, take } from 'rxjs';
import { AuthService } from '../services/auth.service';

/** Waits until the stored Supabase session has been restored, then evaluates `check`. */
function afterSessionRestored(check: (auth: AuthService) => boolean | ReturnType<Router['createUrlTree']>) {
  const auth = inject(AuthService);
  return toObservable(auth.ready).pipe(
    filter(Boolean),
    take(1),
    map(() => check(auth)),
  );
}

/** Protects the app shell: unauthenticated users go to /login (with a return URL). */
export const authGuard: CanActivateFn = (_route, state) => {
  // Prerender/SSR has no session – render the shell; the browser re-checks on hydration.
  if (isPlatformServer(inject(PLATFORM_ID))) return true;
  const router = inject(Router);
  return afterSessionRestored((auth) =>
    auth.isAuthenticated() ? true : router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } }),
  );
};

/** Keeps signed-in users (and demo mode) away from the login page. */
export const guestGuard: CanActivateFn = () => {
  if (isPlatformServer(inject(PLATFORM_ID))) return true;
  const router = inject(Router);
  return afterSessionRestored((auth) =>
    auth.source === 'demo' || auth.isAuthenticated() ? router.createUrlTree(['/dashboard']) : true,
  );
};
