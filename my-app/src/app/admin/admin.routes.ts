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
        path: 'orders',
        loadComponent: () =>
          import('./orders/orders.component').then((m) => m.AdminOrdersComponent),
      },
      {
        path: 'products',
        loadComponent: () =>
          import('./products/products.component').then((m) => m.AdminProductsComponent),
      },
      {
        path: 'combos',
        loadComponent: () =>
          import('./combos/combos.component').then((m) => m.AdminCombosComponent),
      },
      {
        path: 'inventory',
        loadComponent: () =>
          import('./inventory/inventory.component').then((m) => m.AdminInventoryComponent),
      },
      {
        path: 'shipping',
        loadComponent: () =>
          import('./shipping/shipping.component').then((m) => m.AdminShippingComponent),
      },
      {
        path: 'users',
        loadComponent: () =>
          import('./users/users.component').then((m) => m.AdminUsersComponent),
      },
      {
        path: 'support',
        loadComponent: () =>
          import('./support/support.component').then((m) => m.AdminSupportComponent),
      },
      {
        path: 'reviews',
        loadComponent: () =>
          import('./reviews/reviews.component').then((m) => m.AdminReviewsComponent),
      },
      {
        path: 'complaints',
        loadComponent: () =>
          import('./complaints/complaints.component').then((m) => m.AdminComplaintsComponent),
      },
      { path: 'events', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'bookings', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'vouchers',
        loadComponent: () =>
          import('./vouchers/vouchers.component').then((m) => m.AdminVouchersComponent),
      },
      {
        path: 'staff',
        loadComponent: () =>
          import('./staff/staff.component').then((m) => m.AdminStaffComponent),
      },
    ],
  },
  { path: '**', redirectTo: 'admin' },
];
