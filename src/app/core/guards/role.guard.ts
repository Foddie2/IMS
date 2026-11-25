import { isPlatformServer } from '@angular/common';
import { PLATFORM_ID, inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Role } from '../models/api.models';
import { AuthService } from '../services/auth.service';

/**
 * Route guard driven by `data.roles`. Signed-out users go to /login; signed-in users
 * without one of the roles go to /forbidden. The API enforces the same rules.
 *
 * `{ path: 'reports', canActivate: [roleGuard], data: { roles: ['Admin', 'SuperAdmin'] } }`
 */
export const roleGuard: CanActivateFn = (route, state) => {
  if (isPlatformServer(inject(PLATFORM_ID))) return true;

  const auth = inject(AuthService);
  const router = inject(Router);
  const roles = (route.data['roles'] as Role[] | undefined) ?? [];

  if (!auth.isAuthenticated()) {
    return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  }
  return roles.length === 0 || auth.hasRole(roles) ? true : router.createUrlTree(['/forbidden']);
};
