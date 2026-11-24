import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { Permission } from '../models/auth.models';
import { AuthService } from '../services/auth.service';

/**
 * Route guard driven by `data.permission`. Users without it are sent to `/forbidden`.
 *
 * Usage: `{ path: 'settings', canActivate: [permissionGuard], data: { permission: 'settings:manage' } }`
 */
export const permissionGuard: CanActivateFn = (route) => {
  const permission = route.data['permission'] as Permission | undefined;
  if (!permission || inject(AuthService).can(permission)) {
    return true;
  }
  return inject(Router).createUrlTree(['/forbidden']);
};
