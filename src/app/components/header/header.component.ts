import { Component, signal, inject, HostListener, effect } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { CartService } from '../../shared/services/cart.service';
import { OrderApiService } from '../../shared/services/order-api.service';
import { navItems, logoImage } from '../../shared/data/xanh-la.data';
import { CategoryApiService } from '../../shared/services/category-api.service';

const CATEGORIES = [
  { label: 'Rau củ',                 path: '/online-ordering', category: 'Rau củ' },
  { label: 'Trái cây',               path: '/online-ordering', category: 'Trái cây' },
  { label: 'Thịt',                   path: '/online-ordering', category: 'Thịt' },
  { label: 'Cá & Hải sản',           path: '/online-ordering', category: 'Cá & Hải sản' },
  { label: 'Sữa & Thực phẩm mát',    path: '/online-ordering', category: 'Sữa & Thực phẩm mát' },
  { label: 'Thức uống',              path: '/online-ordering', category: 'Thức uống' },
  { label: 'Bánh & Đồ ăn vặt',       path: '/online-ordering', category: 'Bánh & Đồ ăn vặt' },
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
export class HeaderComponent {
  protected cart   = inject(CartService);
  protected router = inject(Router);
  private categoryApi = inject(CategoryApiService, { optional: true });

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
      error: () => {},
    });

    // Cập nhật thông báo tự động theo tài khoản người dùng
    effect(() => {
      const user = this.cart.currentUser();
      this.loadNotifications(user);
    });
  }

  private orderApi = inject(OrderApiService);

  protected readonly navItems    = navItems;
  protected readonly logoImage   = logoImage;
  protected categories           = CATEGORIES;
  protected readonly areas         = AREAS;
  protected notifications          = signal<HeaderNotification[]>([]);

  protected mobileMenuOpen  = signal(false);
  protected userMenuOpen    = signal(false);
  protected catMenuOpen     = signal(false);
  protected areaMenuOpen    = signal(false);
  protected notifMenuOpen   = signal(false);
  protected selectedArea    = signal('TP. Hồ Chí Minh');
  protected copiedCode      = signal<string | null>(null);

  private loadNotifications(user: any): void {
    if (!user) {
      this.notifications.set([
        {
          id: 'guest-welcome',
          title: 'Chào mừng bạn đến với Xanh Lá',
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
            body: 'Cảm ơn bạn đã gia nhập Xanh Lá. Khám phá các thực phẩm hữu cơ tươi ngon ngay.',
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
            body: 'Khám phá các nông sản tươi sạch hữu cơ tại Xanh Lá Farm.',
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

  onSearch(e: Event): void {
    e.preventDefault();
    const form = e.target as HTMLFormElement;
    const q = ((form.elements.namedItem('q') as HTMLInputElement | null)?.value ?? '').trim();
    this.router.navigate(['/online-ordering'], { queryParams: q ? { q } : {} });
    this.closeMobileMenu();
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
    if (!t.closest('.xl-cat-menu-wrapper'))  this.catMenuOpen.set(false);
    if (!t.closest('.xl-area-wrapper'))      this.areaMenuOpen.set(false);
    if (!t.closest('.xl-notif-wrapper'))     this.notifMenuOpen.set(false);
    if (!t.closest('.xanhla-user-menu') && !t.closest('.xl-icon-btn') && !t.closest('.xanhla-member-bar')) {
      this.userMenuOpen.set(false);
    }
  }
}
