import { isPlatformServer } from '@angular/common';
import { PLATFORM_ID, inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../services/auth.service';

/** Protects the app shell: signed-out users go to /login with a return URL. */
export const authGuard: CanActivateFn = (_route, state) => {
  // Prerender/SSR has no browser session – render the shell; the browser re-checks on hydration.
  if (isPlatformServer(inject(PLATFORM_ID))) return true;
  return inject(AuthService).isAuthenticated()
    ? true
    : inject(Router).createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

/** Keeps signed-in users away from the login page. */
export const guestGuard: CanActivateFn = () => {
  if (isPlatformServer(inject(PLATFORM_ID))) return true;
  return inject(AuthService).isAuthenticated() ? inject(Router).createUrlTree(['/dashboard']) : true;
};
