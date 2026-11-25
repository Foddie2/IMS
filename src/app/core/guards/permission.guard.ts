import { inject } from '@angular/core';
import { toObservable } from '@angular/core/rxjs-interop';
import { CanActivateFn, Router } from '@angular/router';
import { filter, map, take } from 'rxjs';
import { Permission } from '../models/auth.models';
import { AuthService } from '../services/auth.service';

/**
 * Route guard driven by `data.permission`. Waits until the user's role is known,
 * then sends users without the permission to `/forbidden`.
 *
 * Usage: `{ path: 'settings', canActivate: [permissionGuard], data: { permission: 'settings:manage' } }`
 */
export const permissionGuard: CanActivateFn = (route) => {
  const permission = route.data['permission'] as Permission | undefined;
  if (!permission) return true;

  const auth = inject(AuthService);
  const router = inject(Router);
  return toObservable(auth.accessReady).pipe(
    filter(Boolean),
    take(1),
    map(() => (auth.can(permission) ? true : router.createUrlTree(['/forbidden']))),
  );
};
