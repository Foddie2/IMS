import { AppUser, Role } from '../models/auth.models';
import { InvenTreeRoles, InvenTreeUser } from '../models/inventree.models';

function can(roles: InvenTreeRoles['roles'], ruleset: string, verb: 'view' | 'add' | 'change' | 'delete') {
  return roles[ruleset]?.includes(verb) ?? false;
}

/**
 * Maps InvenTree's ruleset permissions onto the dashboard's personas:
 * superuser → admin; can delete parts/stock → manager; can change stock → operator; else viewer.
 */
export function mapInvenTreeRole(roles: InvenTreeRoles): Role {
  if (roles.is_superuser) return 'admin';
  if (can(roles.roles, 'part', 'delete') || can(roles.roles, 'stock', 'delete')) return 'manager';
  if (can(roles.roles, 'stock', 'change')) return 'operator';
  return 'viewer';
}

export function mapInvenTreeUser(user: InvenTreeUser, roles: InvenTreeRoles): AppUser {
  const name = [user.first_name, user.last_name].filter(Boolean).join(' ') || user.username;
  const role = mapInvenTreeRole(roles);
  return {
    id: `inventree-${user.pk}`,
    name,
    title: user.email || user.username,
    role,
    // InvenTree has no native site scoping, so live users see every site ('*').
    // Restrict here (e.g. from a user group naming convention) if needed.
    siteIds: ['*'],
  };
}

export function initialsOf(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
}
