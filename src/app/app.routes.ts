import { Routes } from '@angular/router';
import { permissionGuard } from './core/guards/permission.guard';
import { MainLayoutComponent } from './layouts/main-layout/main-layout.component';

const comingSoon = () =>
  import('./pages/coming-soon/coming-soon.component').then((m) => m.ComingSoonComponent);

export const routes: Routes = [
  {
    path: '',
    component: MainLayoutComponent,
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        title: 'Dashboard · Inventra',
        data: { breadcrumb: 'Dashboard' },
        loadComponent: () => import('./pages/dashboard/dashboard.component').then((m) => m.DashboardComponent),
      },
      {
        path: 'inventory',
        title: 'Inventory · Inventra',
        canActivate: [permissionGuard],
        data: { breadcrumb: 'Inventory', permission: 'inventory:view' },
        loadComponent: comingSoon,
      },
      {
        path: 'orders',
        title: 'Orders · Inventra',
        canActivate: [permissionGuard],
        data: { breadcrumb: 'Orders', permission: 'orders:view' },
        loadComponent: comingSoon,
      },
      {
        path: 'shipments',
        title: 'Shipments · Inventra',
        canActivate: [permissionGuard],
        data: { breadcrumb: 'Shipments', permission: 'shipments:view' },
        loadComponent: comingSoon,
      },
      {
        path: 'reports',
        title: 'Reports · Inventra',
        canActivate: [permissionGuard],
        data: { breadcrumb: 'Reports', permission: 'reports:view' },
        loadComponent: comingSoon,
      },
      {
        path: 'settings',
        title: 'Settings · Inventra',
        canActivate: [permissionGuard],
        data: { breadcrumb: 'Settings', permission: 'settings:manage' },
        loadComponent: comingSoon,
      },
      {
        path: 'support',
        title: 'Support · Inventra',
        data: { breadcrumb: 'Support' },
        loadComponent: comingSoon,
      },
      {
        path: 'forbidden',
        title: 'Access denied · Inventra',
        data: { breadcrumb: 'Access denied' },
        loadComponent: () => import('./pages/forbidden/forbidden.component').then((m) => m.ForbiddenComponent),
      },
      {
        path: '**',
        title: 'Not found · Inventra',
        data: { breadcrumb: 'Not found' },
        loadComponent: () => import('./pages/not-found/not-found.component').then((m) => m.NotFoundComponent),
      },
    ],
  },
];
