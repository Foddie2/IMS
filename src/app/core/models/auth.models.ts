/**
 * Role-based access control model.
 *
 * Roles are coarse personas; every UI/route check is expressed in terms of
 * fine-grained permissions so roles can be re-mapped without touching components.
 */

export type Role = 'admin' | 'manager' | 'operator' | 'viewer';

export type Permission =
  | 'inventory:view'
  | 'inventory:edit'
  | 'finance:view'
  | 'orders:view'
  | 'shipments:view'
  | 'reports:view'
  | 'settings:manage'
  /** Access to every site (otherwise limited to `AppUser.siteIds`). */
  | 'sites:all';

export const ROLE_LABELS: Record<Role, string> = {
  admin: 'Administrator',
  manager: 'Operations Manager',
  operator: 'Warehouse Operator',
  viewer: 'Auditor (read-only)',
};

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  admin: [
    'inventory:view',
    'inventory:edit',
    'finance:view',
    'orders:view',
    'shipments:view',
    'reports:view',
    'settings:manage',
    'sites:all',
  ],
  manager: [
    'inventory:view',
    'inventory:edit',
    'finance:view',
    'orders:view',
    'shipments:view',
    'reports:view',
    'sites:all',
  ],
  operator: ['inventory:view', 'inventory:edit', 'orders:view', 'shipments:view'],
  viewer: ['inventory:view', 'finance:view', 'reports:view', 'sites:all'],
};

export interface AppUser {
  id: string;
  name: string;
  title: string;
  role: Role;
  /** Sites the user may access when they lack `sites:all`; `'*'` grants every site. */
  siteIds: readonly string[];
}

export type AuthSource = 'supabase' | 'demo';
