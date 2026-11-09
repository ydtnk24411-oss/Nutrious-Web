import { Routes } from '@angular/router';
import { adminGuard } from './shared/guards/admin.guard';

export const routes: Routes = [
  // ── Root & Shortcuts ──────────────────────────────────────────
  { path: '', redirectTo: 'admin', pathMatch: 'full' },
  { path: 'login', redirectTo: 'admin/login', pathMatch: 'full' },
  { path: 'dashboard', redirectTo: 'admin/dashboard', pathMatch: 'full' },

  // ── Admin Auth ────────────────────────────────────────────────
  {
    path: 'admin/login',
    loadComponent: () =>
      import('./admin/login/login.component').then((m) => m.AdminLoginComponent),
  },

  // ── Admin Management Portal ───────────────────────────────────
  {
    path: 'admin',
    loadComponent: () =>
      import('./admin/layout/admin-layout.component').then((m) => m.AdminLayoutComponent),
    canActivate: [adminGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'dashboard',
        loadComponent: () =>
          import('./admin/dashboard/dashboard.component').then((m) => m.AdminDashboardComponent),
      },
      {
        path: 'products',
        loadComponent: () =>
          import('./admin/products/products.component').then((m) => m.AdminProductsComponent),
      },
      {
        path: 'orders',
        loadComponent: () =>
          import('./admin/orders/orders.component').then((m) => m.AdminOrdersComponent),
      },
      {
        path: 'users',
        loadComponent: () =>
          import('./admin/users/users.component').then((m) => m.AdminUsersComponent),
      },
      {
        path: 'inventory',
        loadComponent: () =>
          import('./admin/inventory/inventory.component').then((m) => m.AdminInventoryComponent),
      },
      {
        path: 'shipping',
        loadComponent: () =>
          import('./admin/shipping/shipping.component').then((m) => m.AdminShippingComponent),
      },
      {
        path: 'support',
        loadComponent: () =>
          import('./admin/support/support.component').then((m) => m.AdminSupportComponent),
      },
      {
        path: 'reviews',
        loadComponent: () =>
          import('./admin/reviews/reviews.component').then((m) => m.AdminReviewsComponent),
      },
      {
        path: 'complaints',
        loadComponent: () =>
          import('./admin/complaints/complaints.component').then((m) => m.AdminComplaintsComponent),
      },
      {
        path: 'vouchers',
        loadComponent: () =>
          import('./admin/vouchers/vouchers.component').then((m) => m.AdminVouchersComponent),
      },
      {
        path: 'staff',
        loadComponent: () =>
          import('./admin/staff/staff.component').then((m) => m.AdminStaffComponent),
      },
    ],
  },

  // ── Fallback ──────────────────────────────────────────────────
  { path: '**', redirectTo: 'admin' },
];
