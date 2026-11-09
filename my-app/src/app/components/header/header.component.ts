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

const AREAS = ['TP. Hồ Chí Minh', 'Hà Nội', 'Đà Nẵng', 'Cần Thơ', 'Biên Hòa'];

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

  protected readonly navItems    = navItems;
  protected readonly logoImage   = logoImage;
  protected categories           = CATEGORIES;
  protected readonly areas       = AREAS;
  protected notifications        = signal<HeaderNotification[]>([]);

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

    // Cập nhật thông báo tự động theo tài khoản người dùng
    effect(() => {
      const user = this.cart.currentUser();
      this.loadNotifications(user);
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
  private loadNotifications(user: any): void {
    if (!user) {
      this.notifications.set([
        {
          id: 'guest-welcome',
          title: 'Chào mừng bạn đến với Evergreen Mart',
          body: 'Nông sản hữu cơ tươi ngon mỗi ngày. Đăng nhập để nhận ưu đãi thành viên.',
          path: '/online-ordering',
          unread: false,
        },
      ]);
      return;
    }

    // Với tài khoản đã đăng nhập: lấy đơn hàng thực tế của chính tài khoản đó
    this.orderApi.getMyOrders().subscribe({
      next: (res) => {
        const orders = res?.data || [];
        const notifs: HeaderNotification[] = [];

        // Tìm các đơn hàng đang hoạt động của user
        const activeOrders = orders.filter((o: any) =>
          ['pending', 'confirmed', 'preparing', 'shipping', 'delivering'].includes(o.status)
        );

        if (activeOrders.length > 0) {
          for (const ord of activeOrders.slice(0, 3)) {
            const isShipping = ['shipping', 'delivering'].includes(ord.status);
            notifs.push({
              id: 'ord-' + ord._id,
              title: isShipping ? 'Đơn hàng đang giao' : 'Đơn hàng đang xử lý',
              body: `Đơn #${ord.orderCode || ord._id.slice(-6)} ${isShipping ? 'đang trên đường giao đến bạn.' : 'đang được chuẩn bị nguyên liệu.'}`,
              path: `/tracker-page?code=${ord.orderCode || ''}`,
              unread: true,
            });
          }
        } else {
          // Tài khoản mới / không có đơn nào đang giao: hiển thị lời chào và hướng dẫn nhận ưu đãi
          notifs.push({
            id: 'welcome-member',
            title: `Chào mừng ${user.name}!`,
            body: 'Cảm ơn bạn đã gia nhập Evergreen Mart. Khám phá các thực phẩm hữu cơ tươi ngon ngay.',
            path: '/online-ordering',
            unread: true,
          });
          notifs.push({
            id: 'member-voucher',
            title: 'Ưu đãi thành viên mới',
            body: 'Tích điểm nhận quà và voucher cho mỗi đơn hàng thành công.',
            path: '/loyalty',
            unread: false,
          });
        }

        this.notifications.set(notifs);
      },
      error: () => {
        this.notifications.set([
          {
            id: 'welcome-member',
            title: `Chào mừng ${user.name}!`,
            body: 'Khám phá các nông sản tươi sạch hữu cơ tại Evergreen Mart.',
            path: '/online-ordering',
            unread: false,
          },
        ]);
      },
    });
  }

  protected unreadCount(): number {
    return this.notifications().filter(n => n.unread).length;
  }

  markAllAsRead(): void {
    this.notifications.update(items => items.map(n => ({ ...n, unread: false })));
  }

  toggleMobileMenu(): void { this.mobileMenuOpen.update(v => !v); }
  closeMobileMenu(): void  { this.mobileMenuOpen.set(false); }
  toggleUserMenu(): void   { this.userMenuOpen.update(v => !v); this.areaMenuOpen.set(false); this.notifMenuOpen.set(false); }
  closeUserMenu(): void    { this.userMenuOpen.set(false); }
  toggleCatMenu(): void    { this.catMenuOpen.update(v => !v); }
  closeCatMenu(): void     { this.catMenuOpen.set(false); }
  toggleAreaMenu(): void   { this.areaMenuOpen.update(v => !v); this.userMenuOpen.set(false); this.notifMenuOpen.set(false); }
  toggleNotifMenu(): void  { this.notifMenuOpen.update(v => !v); this.userMenuOpen.set(false); this.areaMenuOpen.set(false); }
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
    if (!t.closest('.xl-area-wrapper'))      this.areaMenuOpen.set(false);
    if (!t.closest('.xl-notif-wrapper'))     this.notifMenuOpen.set(false);
    if (!t.closest('.xanhla-user-menu') && !t.closest('.xl-icon-btn') && !t.closest('.xanhla-member-bar')) {
      this.userMenuOpen.set(false);
    }
  }
}
