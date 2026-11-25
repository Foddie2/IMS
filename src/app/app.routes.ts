import { Routes } from '@angular/router';
import { authGuard, guestGuard } from './core/guards/auth.guard';
import { permissionGuard } from './core/guards/permission.guard';
import { MainLayoutComponent } from './layouts/main-layout/main-layout.component';

const comingSoon = () =>
  import('./pages/coming-soon/coming-soon.component').then((m) => m.ComingSoonComponent);

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
        path: 'inventory',
        title: 'Inventory · IMS',
        canActivate: [permissionGuard],
        data: { breadcrumb: 'Inventory', permission: 'inventory:view' },
        loadComponent: comingSoon,
      },
      {
        path: 'orders',
        title: 'Orders · IMS',
        canActivate: [permissionGuard],
        data: { breadcrumb: 'Orders', permission: 'orders:view' },
        loadComponent: comingSoon,
      },
      {
        path: 'shipments',
        title: 'Shipments · IMS',
        canActivate: [permissionGuard],
        data: { breadcrumb: 'Shipments', permission: 'shipments:view' },
        loadComponent: comingSoon,
      },
      {
        path: 'reports',
        title: 'Reports · IMS',
        canActivate: [permissionGuard],
        data: { breadcrumb: 'Reports', permission: 'reports:view' },
        loadComponent: comingSoon,
      },
      {
        path: 'settings',
        title: 'Settings · IMS',
        canActivate: [permissionGuard],
        data: { breadcrumb: 'Settings', permission: 'settings:manage' },
        loadComponent: comingSoon,
      },
      {
        path: 'support',
        title: 'Support · IMS',
        data: { breadcrumb: 'Support' },
        loadComponent: comingSoon,
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
