import { Routes } from '@angular/router';

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

  // ── Trang Thông tin, Hỗ trợ & Chính sách ─────────────────────
  {
    path: 'gioi-thieu',
    data: { section: 'about' },
    loadComponent: () =>
      import('./pages/info/info-page.component').then((m) => m.InfoPageComponent),
  },
  {
    path: 'hoi-dap',
    data: { section: 'faq' },
    loadComponent: () =>
      import('./pages/info/info-page.component').then((m) => m.InfoPageComponent),
  },
  {
    path: 'ho-tro',
    data: { section: 'help' },
    loadComponent: () =>
      import('./pages/info/info-page.component').then((m) => m.InfoPageComponent),
  },
  {
    path: 'lien-he',
    data: { section: 'contact' },
    loadComponent: () =>
      import('./pages/info/info-page.component').then((m) => m.InfoPageComponent),
  },
  { path: 'chinh-sach', redirectTo: 'chinh-sach/giao-hang', pathMatch: 'full' },
  {
    path: 'chinh-sach/:slug',
    loadComponent: () =>
      import('./pages/info/info-page.component').then((m) => m.InfoPageComponent),
  },

  // ── Redirect các trang đã xóa ────────────────────────────────
  { path: 'menus',                  redirectTo: 'online-ordering', pathMatch: 'full' },
  { path: 'menus-1',                redirectTo: 'online-ordering', pathMatch: 'full' },
  { path: 'category/all-products',  redirectTo: 'online-ordering', pathMatch: 'full' },
  { path: 'category/:slug',         redirectTo: 'online-ordering', pathMatch: 'full' },

  // ── Fallback ──────────────────────────────────────────────────
  { path: '**', redirectTo: '' },
];
