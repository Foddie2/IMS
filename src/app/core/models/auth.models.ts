import { Role } from './api.models';

export type { Role } from './api.models';

/**
 * Role-based access control. The API is the authority (it enforces every rule server-side);
 * the UI uses the same role hierarchy to hide actions a user could not perform anyway.
 *
 *   User        read inventory/products/warehouses, record stock movements (assigned warehouses only)
 *   Admin       + manage products & purchase orders, cost data, reports & audit log, all warehouses
 *   SuperAdmin  + delete products, manage users, roles and warehouse assignments
 */
export const ROLES: readonly Role[] = ['User', 'Admin', 'SuperAdmin'];

export const ROLE_LABELS: Record<Role, string> = {
  User: 'User',
  Admin: 'Admin',
  SuperAdmin: 'Super Admin',
};

export type Permission =
  | 'inventory:view'
  | 'inventory:edit'
  | 'products:manage'
  | 'products:delete'
  | 'finance:view'
  | 'orders:manage'
  | 'reports:view'
  | 'users:manage'
  /** Access to every warehouse (otherwise limited to the user's assigned ones). */
  | 'sites:all';

const USER_PERMISSIONS: readonly Permission[] = ['inventory:view', 'inventory:edit'];
const ADMIN_PERMISSIONS: readonly Permission[] = [
  ...USER_PERMISSIONS,
  'products:manage',
  'finance:view',
  'orders:manage',
  'reports:view',
  'sites:all',
];

export const ROLE_PERMISSIONS: Record<Role, readonly Permission[]> = {
  User: USER_PERMISSIONS,
  Admin: ADMIN_PERMISSIONS,
  SuperAdmin: [...ADMIN_PERMISSIONS, 'products:delete', 'users:manage'],
};

export interface AppUser {
  id: number;
  name: string;
  email: string;
  /** Display subtitle, e.g. the role label. */
  title: string;
  role: Role;
  /** Accessible warehouse ids as strings; `'*'` = every warehouse. */
  siteIds: readonly string[];
}
