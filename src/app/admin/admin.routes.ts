import { Routes } from '@angular/router';
import { adminGuard } from '../shared/guards/admin.guard';

/** Routes of the standalone admin app (served on http://localhost:4201). */
export const adminRoutes: Routes = [
  { path: '', redirectTo: 'admin', pathMatch: 'full' },
  {
    path: 'admin/login',
    loadComponent: () =>
      import('./login/login.component').then((m) => m.AdminLoginComponent),
  },
  {
    path: 'admin',
    loadComponent: () =>
      import('./layout/admin-layout.component').then((m) => m.AdminLayoutComponent),
    canActivate: [adminGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./dashboard/dashboard.component').then((m) => m.AdminDashboardComponent),
      },
      {
        path: 'products',
        loadComponent: () =>
          import('./products/products.component').then((m) => m.AdminProductsComponent),
      },
      {
        path: 'orders',
        loadComponent: () =>
          import('./orders/orders.component').then((m) => m.AdminOrdersComponent),
      },
      {
        path: 'users',
        loadComponent: () =>
          import('./users/users.component').then((m) => m.AdminUsersComponent),
      },
      {
        path: 'events',
        loadComponent: () =>
          import('./events/events.component').then((m) => m.AdminEventsComponent),
      },
      {
        path: 'bookings',
        loadComponent: () =>
          import('./bookings/bookings.component').then((m) => m.AdminBookingsComponent),
      },
    ],
  },
  { path: '**', redirectTo: 'admin' },
];
