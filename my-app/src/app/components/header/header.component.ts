import { Component, signal, inject, HostListener, effect, computed, OnDestroy } from '@angular/core';
import { RouterLink, Router, NavigationEnd } from '@angular/router';
import { filter, Subscription } from 'rxjs';
import { CommonModule } from '@angular/common';
import { CartService } from '../../shared/services/cart.service';
import { OrderApiService } from '../../shared/services/order-api.service';
import { navItems, logoImage } from '../../shared/data/xanh-la.data';
import { CategoryApiService } from '../../shared/services/category-api.service';
import { ProductApiService, ApiProduct } from '../../shared/services/product-api.service';
import { searchProducts, highlightMatch } from '../../shared/utils/search.util';
import { NotificationService, InAppNotification } from '../../shared/services/notification.service';
import { WishlistService } from '../../shared/services/wishlist.service';
import { AnalyticsTrackerService } from '../../shared/services/analytics-tracker.service';
import { StoreLocationService } from '../../shared/services/store-location.service';
import { WarehouseLocation } from '../../shared/services/shipping-api.service';

const CATEGORIES = [
  { label: 'Rau củ', path: '/online-ordering', category: 'Rau củ' },
  { label: 'Trái cây', path: '/online-ordering', category: 'Trái cây' },
  { label: 'Thịt', path: '/online-ordering', category: 'Thịt' },
  { label: 'Cá & Hải sản', path: '/online-ordering', category: 'Cá & Hải sản' },
  { label: 'Sữa & Thực phẩm mát', path: '/online-ordering', category: 'Sữa & Thực phẩm mát' },
  { label: 'Thức uống', path: '/online-ordering', category: 'Thức uống' },
  { label: 'Bánh & Đồ ăn vặt', path: '/online-ordering', category: 'Bánh & Đồ ăn vặt' },
  { label: 'Gia vị & Thực phẩm khô', path: '/online-ordering', category: 'Gia vị & Thực phẩm khô' },
];

const AREAS = ['TP. Hồ Chí Minh', 'Dĩ An (Bình Dương)'];

export interface HeaderNotification {
  id: string;
  title: string;
  body: string;
  path: string;
  unread: boolean;
  time?: string;
}

@Component({
  selector: 'app-header',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './header.component.html',
  styleUrl: './header.component.css',
})
export class HeaderComponent implements OnDestroy {
  private navSub?: Subscription;
  protected cart = inject(CartService);
  protected router = inject(Router);
  private categoryApi = inject(CategoryApiService, { optional: true });
  private productApi = inject(ProductApiService, { optional: true });
  private orderApi = inject(OrderApiService);
  protected notifService = inject(NotificationService);
  protected wishlist = inject(WishlistService);
  private analytics = inject(AnalyticsTrackerService);
  protected storeLoc = inject(StoreLocationService);
  protected isLocatingGps = signal(false);

  protected readonly navItems    = navItems;
  protected readonly logoImage   = logoImage;
  protected categories           = CATEGORIES;
  protected readonly areas       = AREAS;
  protected readonly notifications = this.notifService.notifications;
  protected readonly unreadCount = this.notifService.unreadCount;

  protected mobileMenuOpen  = signal(false);
  protected userMenuOpen    = signal(false);
  protected catMenuOpen     = signal(false);
  protected areaMenuOpen    = signal(false);
  protected notifMenuOpen   = signal(false);
  protected selectedArea    = signal('TP. Hồ Chí Minh');
  protected copiedCode      = signal<string | null>(null);

  // Search & Suggestions state
  protected searchQuery = signal('');
  protected showSuggestions = signal(false);
  protected selectedSuggestionIndex = signal(-1);
  protected allProducts = signal<ApiProduct[]>([]);
  protected popularKeywords = [
    'Rau hữu cơ',
    'Trái cây tươi',
    'Thịt sạch',
    'Cá hồi',
    'Sữa hạt',
    'Nấm tươi',
    'Khoai lang mật',
    'Gạo ST25',
  ];
  protected readonly fallbackImage = 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=700&q=80';

  protected suggestedProducts = computed(() => {
    const q = this.searchQuery();
    return searchProducts(this.allProducts(), q, 6);
  });

  constructor() {
    this.categoryApi?.getAll().subscribe({
      next: (res) => {
        if (res?.data?.length) {
          this.categories = res.data.map(cat => ({
            label: cat.name,
            path: '/online-ordering',
            category: cat.name,
          }));
        }
      },
      error: () => { },
    });

    // Đồng bộ từ khóa tìm kiếm trên thanh search với URL hiện tại
    const syncQueryFromUrl = () => {
      try {
        const urlTree = this.router.parseUrl(this.router.url);
        const q = urlTree.queryParams['q'];
        if (q) {
          this.searchQuery.set(q);
        } else if (!this.router.url.startsWith('/online-ordering')) {
          this.searchQuery.set('');
        }
      } catch {}
    };

    syncQueryFromUrl();

    this.navSub = this.router.events.pipe(
      filter((e): e is NavigationEnd => e instanceof NavigationEnd)
    ).subscribe((e) => {
      try {
        const urlTree = this.router.parseUrl(e.urlAfterRedirects);
        const q = urlTree.queryParams['q'];
        if (q) {
          this.searchQuery.set(q);
        } else if (!e.urlAfterRedirects.startsWith('/online-ordering')) {
          this.searchQuery.set('');
        }
      } catch {}
    });

    // Khởi tạo tải sản phẩm để gợi ý tìm kiếm tức thì
    this.loadProducts();
  }

  private loadProducts(): void {
    if (!this.productApi || this.allProducts().length > 0) return;
    this.productApi.getAll({ limit: 0, sort: 'createdAt' }).subscribe({
      next: (res) => {
        if (res?.data?.length) {
          this.allProducts.set(res.data);
        }
      },
      error: () => {},
    });
  }

  markAllAsRead(): void {
    this.notifService.markAllAsRead();
  }

  onNotifClick(n: InAppNotification): void {
    if (n.unread) {
      this.notifService.markAsRead(n.id);
    }
    this.closeNotifMenu();
  }

  toggleMobileMenu(): void { this.mobileMenuOpen.update(v => !v); }
  closeMobileMenu(): void  { this.mobileMenuOpen.set(false); }
  toggleUserMenu(): void   { this.userMenuOpen.update(v => !v); this.areaMenuOpen.set(false); this.notifMenuOpen.set(false); }
  closeUserMenu(): void    { this.userMenuOpen.set(false); }
  toggleCatMenu(): void    { this.catMenuOpen.update(v => !v); }
  closeCatMenu(): void     { this.catMenuOpen.set(false); }
  toggleAreaMenu(): void   { this.areaMenuOpen.update(v => !v); this.userMenuOpen.set(false); this.notifMenuOpen.set(false); }
  toggleNotifMenu(): void  {
    const next = !this.notifMenuOpen();
    this.notifMenuOpen.set(next);
    this.userMenuOpen.set(false);
    this.areaMenuOpen.set(false);
    if (next) {
      this.notifService.loadHistory();
    }
  }
  closeNotifMenu(): void   { this.notifMenuOpen.set(false); }

  onSearchInput(e: Event): void {
    const val = (e.target as HTMLInputElement).value || '';
    this.searchQuery.set(val);
    this.showSuggestions.set(true);
    this.selectedSuggestionIndex.set(-1);
    if (this.allProducts().length === 0) {
      this.loadProducts();
    }
  }

  onSearchFocus(): void {
    this.showSuggestions.set(true);
    if (this.allProducts().length === 0) {
      this.loadProducts();
    }
  }

  ngOnDestroy(): void {
    this.navSub?.unsubscribe();
  }

  clearSearch(): void {
    if (this.router.url.startsWith('/online-ordering')) {
      this.router.navigate(['/online-ordering']);
    }
    this.searchQuery.set('');
    this.selectedSuggestionIndex.set(-1);
  }

  applyKeyword(kw: string): void {
    this.searchQuery.set(kw);
    this.showSuggestions.set(true);
    this.selectedSuggestionIndex.set(-1);
    if (this.allProducts().length === 0) {
      this.loadProducts();
    }
  }

  selectProduct(p: ApiProduct): void {
    this.showSuggestions.set(false);
    this.closeMobileMenu();
    this.searchQuery.set('');
    this.selectedSuggestionIndex.set(-1);
    const cleanSlug = (p.slug || '').replace(/^\/product-page\//, '');
    this.router.navigate(['/product-page', cleanSlug]);
  }

  viewAllResults(): void {
    this.executeSearch(this.searchQuery().trim());
  }

  onSearch(e?: Event): void {
    if (e) e.preventDefault();
    const selectedIdx = this.selectedSuggestionIndex();
    const suggestions = this.suggestedProducts();
    if (selectedIdx >= 0 && selectedIdx < suggestions.length) {
      this.selectProduct(suggestions[selectedIdx]);
      return;
    }
    this.executeSearch(this.searchQuery().trim());
  }

  private executeSearch(q: string): void {
    this.showSuggestions.set(false);
    this.closeMobileMenu();
    if (q && q.trim().length >= 2) {
      const matchCount = this.suggestedProducts().length;
      this.analytics.trackSearch(q.trim(), matchCount);
    }
    this.router.navigate(['/online-ordering'], { queryParams: q ? { q } : {} });
  }

  onSearchKeyDown(e: KeyboardEvent): void {
    const suggestions = this.suggestedProducts();
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (!this.showSuggestions()) {
        this.showSuggestions.set(true);
        return;
      }
      if (suggestions.length > 0) {
        this.selectedSuggestionIndex.update(i => (i + 1) % suggestions.length);
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (suggestions.length > 0) {
        this.selectedSuggestionIndex.update(i => (i <= 0 ? suggestions.length - 1 : i - 1));
      }
    } else if (e.key === 'Enter') {
      const idx = this.selectedSuggestionIndex();
      if (idx >= 0 && idx < suggestions.length) {
        e.preventDefault();
        this.selectProduct(suggestions[idx]);
      }
      // Otherwise form submit will handle executeSearch
    } else if (e.key === 'Escape') {
      this.showSuggestions.set(false);
    }
  }

  formatPrice(p: ApiProduct): string {
    if (p.price && p.price.trim()) return p.price;
    if (typeof p.priceNumber === 'number') {
      return `${p.priceNumber.toLocaleString('vi-VN')}đ`;
    }
    return '';
  }

  highlightMatch(text: string, q: string): string {
    return highlightMatch(text, q);
  }

  onThumbError(e: Event): void {
    const img = e.target as HTMLImageElement;
    if (img && img.src !== this.fallbackImage) {
      img.src = this.fallbackImage;
    }
  }

  selectArea(area: string): void {
    this.selectedArea.set(area);
    this.areaMenuOpen.set(false);
  }

  selectWarehouse(wh: WarehouseLocation): void {
    this.storeLoc.selectStore(wh);
    this.selectedArea.set(wh.name);
    this.areaMenuOpen.set(false);
  }

  locateGps(): void {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      alert('Trình duyệt của bạn không hỗ trợ định vị vị trí GPS.');
      return;
    }
    this.isLocatingGps.set(true);
    this.storeLoc.detectLocationAndSelectNearest(
      (wh) => {
        this.isLocatingGps.set(false);
        this.selectedArea.set(wh.name);
        this.areaMenuOpen.set(false);
      },
      () => {
        this.isLocatingGps.set(false);
        alert('Không thể xác định tọa độ GPS tự động. Vui lòng bấm chọn chi nhánh từ danh sách bên dưới.');
      }
    );
  }

  logout(): void {
    this.cart.logout();
    this.userMenuOpen.set(false);
  }

  isActive(path: string): boolean {
    if (path === '/') return this.router.url === '/';
    return this.router.url.startsWith(path);
  }

  @HostListener('document:click', ['$event'])
  onDocClick(e: Event): void {
    const t = e.target as HTMLElement;
    if (!t.closest('.xl-header-search-wrapper')) this.showSuggestions.set(false);
    if (!t.closest('.xl-cat-menu-wrapper'))  this.catMenuOpen.set(false);
    if (!t.closest('.xl-subnav-store-wrapper') && !t.closest('.xl-area-wrapper')) this.areaMenuOpen.set(false);
    if (!t.closest('.xl-notif-wrapper'))     this.notifMenuOpen.set(false);
    if (
      !t.closest('.xanhla-user-menu') &&
      !t.closest('.xl-account-wrapper') &&
      !t.closest('.xl-account-btn') &&
      !t.closest('.xl-icon-btn') &&
      !t.closest('.xanhla-member-bar')
    ) {
      this.userMenuOpen.set(false);
    }
  }
}
