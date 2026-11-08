import { Routes } from '@angular/router';
import { adminGuard } from './shared/guards/admin.guard';

export const routes: Routes = [
  // ── Public storefront routes ──────────────────────────────────
  {
    path: '',
    loadComponent: () =>
      import('./pages/home/home.component').then((m) => m.HomeComponent),
  },
  {
    path: 'online-ordering',
    loadComponent: () =>
      import('./pages/ordering/ordering.component').then((m) => m.OrderingComponent),
  },
  { path: 'event-list', redirectTo: 'online-ordering', pathMatch: 'full' },
  { path: 'event-details/:slug', redirectTo: 'online-ordering' },
  {
    path: 'product-page/:slug',
    loadComponent: () =>
      import('./pages/product-detail/product-detail.component').then((m) => m.ProductDetailComponent),
  },
  { path: 'book-online', redirectTo: 'online-ordering', pathMatch: 'full' },
  { path: 'service-page/:slug', redirectTo: 'online-ordering' },
  {
    path: 'cart',
    loadComponent: () =>
      import('./pages/cart/cart.component').then((m) => m.CartComponent),
  },
  {
    path: 'checkout',
    loadComponent: () =>
      import('./pages/checkout/checkout.component').then((m) => m.CheckoutComponent),
  },
  {
    path: 'account',
    loadComponent: () =>
      import('./pages/account/account.component').then((m) => m.AccountComponent),
  },
  {
    path: 'promotions',
    loadComponent: () =>
      import('./pages/promotions/promotions.component').then((m) => m.PromotionsComponent),
  },
  {
    path: 'vouchers',
    loadComponent: () =>
      import('./pages/vouchers/vouchers.component').then((m) => m.VouchersComponent),
  },
  {
    path: 'loyalty',
    loadComponent: () =>
      import('./pages/loyalty/loyalty.component').then((m) => m.LoyaltyComponent),
  },
  {
    path: 'order/:orderCode',
    loadComponent: () =>
      import('./pages/order-detail/order-detail.component').then((m) => m.OrderDetailComponent),
  },
  {
    path: 'tracker-page',
    loadComponent: () =>
      import('./pages/tracker/tracker.component').then((m) => m.TrackerComponent),
  },
  {
    path: 'complaint',
    loadComponent: () =>
      import('./pages/complaint/complaint.component').then((m) => m.ComplaintComponent),
  },
  {
    path: 'khieu-nai',
    redirectTo: 'complaint',
    pathMatch: 'full',
  },

  {
    path: 'nutrition',
    loadComponent: () =>
      import('./pages/nutrition/nutrition.component').then((m) => m.NutritionComponent),
  },
  {
    path: 'cook-with-what-you-have',
    loadComponent: () =>
      import('./pages/cook/cook.component').then((m) => m.CookComponent),
  },
  {
    path: 'cam-nang/:slug',
    loadComponent: () =>
      import('./pages/handbook/handbook-detail.component').then((m) => m.HandbookDetailComponent),
  },
  {
    path: 'cam-nang',
    loadComponent: () =>
      import('./pages/handbook/handbook-detail.component').then((m) => m.HandbookDetailComponent),
  },

  // ── Redirect các trang đã xóa ────────────────────────────────
  { path: 'menus',                  redirectTo: 'online-ordering', pathMatch: 'full' },
  { path: 'menus-1',                redirectTo: 'online-ordering', pathMatch: 'full' },
  { path: 'category/all-products',  redirectTo: 'online-ordering', pathMatch: 'full' },
  { path: 'category/:slug',         redirectTo: 'online-ordering', pathMatch: 'full' },

  // ── Admin routes ──────────────────────────────────────────────
  {
    path: 'admin/login',
    loadComponent: () =>
      import('./admin/login/login.component').then((m) => m.AdminLoginComponent),
  },
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
      { path: 'events', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'bookings', redirectTo: 'dashboard', pathMatch: 'full' },
      {
        path: 'inventory',
        loadComponent: () =>
          import('./admin/inventory/inventory.component').then((m) => m.AdminInventoryComponent),
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
  { path: '**', redirectTo: '' },
];
