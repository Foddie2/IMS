import { UserDto } from '../models/api.models';
import { AppUser, ROLE_LABELS } from '../models/auth.models';

/** Maps the API user to the app user used for RBAC and display. */
export function mapUser(user: UserDto): AppUser {
  return {
    id: user.id,
    name: user.fullName || user.email,
    email: user.email,
    title: ROLE_LABELS[user.role],
    role: user.role,
    siteIds: user.role === 'User' ? user.assignedWarehouseIds.map(String) : ['*'],
  };
}

export function initialsOf(name: string): string {
  return name
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}

/** Reads the `exp` claim of a JWT (seconds since epoch) without verifying it. */
export function tokenExpiry(token: string): number | null {
  try {
    const payload = token.split('.')[1];
    if (!payload) return null;
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const exp = (JSON.parse(json) as { exp?: unknown }).exp;
    return typeof exp === 'number' ? exp * 1000 : null;
  } catch {
    return null;
  }
}
