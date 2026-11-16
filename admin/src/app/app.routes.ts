import { Routes } from '@angular/router';
import { adminGuard, roleGuard } from './shared/guards/admin.guard';

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
  {
    path: 'admin/login-failed',
    loadComponent: () =>
      import('./admin/login-failed/login-failed.component').then((m) => m.AdminLoginFailedComponent),
  },

  // ── Admin Management Portal (Phân quyền RBAC 4 vai trò) ──────
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
        canActivate: [roleGuard(['Manager', 'Admin', 'Sales', 'Marketing', 'Warehouse'])],
      },
      {
        path: 'finance',
        loadComponent: () =>
          import('./admin/finance/finance.component').then((m) => m.AdminFinanceComponent),
        canActivate: [roleGuard(['Manager', 'Admin'])],
      },
      {
        path: 'analytics',
        loadComponent: () =>
          import('./admin/analytics/analytics.component').then((m) => m.AdminAnalyticsComponent),
        canActivate: [roleGuard(['Manager', 'Admin', 'Marketing'])],
      },
      {
        path: 'orders',
        loadComponent: () =>
          import('./admin/orders/orders.component').then((m) => m.AdminOrdersComponent),
        canActivate: [roleGuard(['Manager', 'Admin', 'Sales', 'Warehouse'])],
      },
      {
        path: 'products',
        loadComponent: () =>
          import('./admin/products/products.component').then((m) => m.AdminProductsComponent),
        canActivate: [roleGuard(['Manager', 'Admin', 'Marketing', 'Warehouse', 'Sales'])],
      },
      {
        path: 'combos',
        loadComponent: () =>
          import('./admin/combos/combos.component').then((m) => m.AdminCombosComponent),
        canActivate: [roleGuard(['Manager', 'Admin', 'Marketing'])],
      },
      {
        path: 'inventory',
        loadComponent: () =>
          import('./admin/inventory/inventory.component').then((m) => m.AdminInventoryComponent),
        canActivate: [roleGuard(['Manager', 'Admin', 'Warehouse'])],
      },
      {
        path: 'shipping',
        loadComponent: () =>
          import('./admin/shipping/shipping.component').then((m) => m.AdminShippingComponent),
        canActivate: [roleGuard(['Manager', 'Admin', 'Warehouse'])],
      },
      {
        path: 'users',
        loadComponent: () =>
          import('./admin/users/users.component').then((m) => m.AdminUsersComponent),
        canActivate: [roleGuard(['Manager', 'Admin', 'Sales'])],
      },
      {
        path: 'support',
        loadComponent: () =>
          import('./admin/support/support.component').then((m) => m.AdminSupportComponent),
        canActivate: [roleGuard(['Manager', 'Admin', 'Sales', 'Support'])],
      },
      {
        path: 'reviews',
        loadComponent: () =>
          import('./admin/reviews/reviews.component').then((m) => m.AdminReviewsComponent),
        canActivate: [roleGuard(['Manager', 'Admin', 'Sales', 'Marketing'])],
      },
      {
        path: 'complaints',
        loadComponent: () =>
          import('./admin/complaints/complaints.component').then((m) => m.AdminComplaintsComponent),
        canActivate: [roleGuard(['Manager', 'Admin', 'Sales', 'Support'])],
      },
      {
        path: 'vouchers',
        loadComponent: () =>
          import('./admin/vouchers/vouchers.component').then((m) => m.AdminVouchersComponent),
        canActivate: [roleGuard(['Manager', 'Admin', 'Marketing', 'Sales'])],
      },
      {
        path: 'staff',
        loadComponent: () =>
          import('./admin/staff/staff.component').then((m) => m.AdminStaffComponent),
        canActivate: [roleGuard(['Manager', 'Admin'])],
      },
    ],
  },

  // ── Fallback ──────────────────────────────────────────────────
  { path: '**', redirectTo: 'admin' },
];
