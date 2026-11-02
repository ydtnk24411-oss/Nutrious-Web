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
  {
    path: 'event-list',
    loadComponent: () =>
      import('./pages/events/events.component').then((m) => m.EventsComponent),
  },
  {
    path: 'event-details/:slug',
    loadComponent: () =>
      import('./pages/event-detail/event-detail.component').then((m) => m.EventDetailComponent),
  },
  {
    path: 'product-page/:slug',
    loadComponent: () =>
      import('./pages/product-detail/product-detail.component').then((m) => m.ProductDetailComponent),
  },
  {
    path: 'book-online',
    loadComponent: () =>
      import('./pages/booking/booking.component').then((m) => m.BookingComponent),
  },
  {
    path: 'service-page/:slug',
    loadComponent: () =>
      import('./pages/service-detail/service-detail.component').then((m) => m.ServiceDetailComponent),
  },
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

  // ── Fallback ──────────────────────────────────────────────────
  { path: '**', redirectTo: '' },
];
