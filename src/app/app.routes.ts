import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guard';
import { roleGuard } from './core/guards/role.guard';
import { Role } from './core/models/api.models';
import { MainLayoutComponent } from './layouts/main-layout/main-layout.component';

const ANY: Role[] = ['User', 'Admin', 'SuperAdmin'];
const ADMIN_UP: Role[] = ['Admin', 'SuperAdmin'];
const SUPER_ADMIN: Role[] = ['SuperAdmin'];

export const routes: Routes = [
  {
    path: 'login',
    title: 'Sign in · IMS',
    canActivate: [guestGuard],
    loadComponent: () => import('./pages/login/login.component').then((m) => m.LoginComponent),
  },
  {
    path: '',
    component: MainLayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        title: 'Dashboard · IMS',
        data: { breadcrumb: 'Dashboard' },
        loadComponent: () => import('./pages/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'products',
        title: 'Products · IMS',
        canActivate: [roleGuard],
        data: { breadcrumb: 'Products', roles: ANY },
        loadComponent: () => import('./pages/products/products-page.component').then((m) => m.ProductsPageComponent),
      },
      {
        path: 'inventory',
        title: 'Inventory · IMS',
        canActivate: [roleGuard],
        data: { breadcrumb: 'Inventory', roles: ANY },
        loadComponent: () => import('./pages/inventory/inventory-page.component').then((m) => m.InventoryPageComponent),
      },
      {
        path: 'orders',
        title: 'Purchase Orders · IMS',
        canActivate: [roleGuard],
        data: { breadcrumb: 'Purchase Orders', roles: ADMIN_UP },
        loadComponent: () => import('./pages/orders/orders-page.component').then((m) => m.OrdersPageComponent),
      },
      {
        path: 'shipments',
        title: 'Shipments · IMS',
        canActivate: [roleGuard],
        data: { breadcrumb: 'Shipments', roles: ANY },
        loadComponent: () => import('./pages/shipments/shipments-page.component').then((m) => m.ShipmentsPageComponent),
      },
      {
        path: 'reports',
        title: 'Reports · IMS',
        canActivate: [roleGuard],
        data: { breadcrumb: 'Reports', roles: ADMIN_UP },
        loadComponent: () => import('./pages/reports/reports-page.component').then((m) => m.ReportsPageComponent),
      },
      {
        path: 'settings',
        title: 'Users & Access · IMS',
        canActivate: [roleGuard],
        data: { breadcrumb: 'Users & Access', roles: SUPER_ADMIN },
        loadComponent: () => import('./pages/settings/users-page.component').then((m) => m.UsersPageComponent),
      },
      {
        path: 'support',
        title: 'Support · IMS',
        data: { breadcrumb: 'Support' },
        loadComponent: () => import('./pages/coming-soon/coming-soon.component').then((m) => m.ComingSoonComponent),
      },
      {
        path: 'forbidden',
        title: 'Access denied · IMS',
        data: { breadcrumb: 'Access denied' },
        loadComponent: () => import('./pages/forbidden/forbidden.component').then((m) => m.ForbiddenComponent),
      },
      {
        path: '**',
        title: 'Not found · IMS',
        data: { breadcrumb: 'Not found' },
        loadComponent: () => import('./pages/not-found/not-found.component').then((m) => m.NotFoundComponent),
      },
    ],
  },
];
