import { Component, signal, computed, inject, HostListener, ViewChild, ElementRef, OnInit, OnDestroy } from '@angular/core';
import { RouterLink, RouterOutlet, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminAuthService } from '../../shared/services/admin-auth.service';
import { ProductApiService } from '../../shared/services/product-api.service';
import { OrderApiService } from '../../shared/services/order-api.service';
import { UserApiService } from '../../shared/services/user-api.service';
import { SupportApiService } from '../../shared/services/support-api.service';
import { DashboardApiService } from '../../shared/services/dashboard-api.service';

export interface AdminNavSubItem {
  id: string;
  label: string;
  path: string;
  queryParam?: Record<string, string>;
}

export interface AdminNavItem {
  id: string;
  label: string;
  path: string;
  badge?: string | number;
  children?: AdminNavSubItem[];
}

export interface AdminNavSection {
  title?: string;
  items: AdminNavItem[];
}

@Component({
  selector: 'app-admin-layout',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, RouterOutlet],
  templateUrl: './admin-layout.component.html',
  styleUrl: './admin-layout.component.css',
})
export class AdminLayoutComponent implements OnInit, OnDestroy {
  protected auth       = inject(AdminAuthService);
  protected router     = inject(Router);
  private productApi   = inject(ProductApiService);
  private orderApi     = inject(OrderApiService);
  private userApi      = inject(UserApiService);
  private supportApi   = inject(SupportApiService);
  private dashApi      = inject(DashboardApiService);

  sidebarOpen = signal(true);
  mobileNavOpen = signal(false);
  unreadSupportCount = signal(0);
  notifOpen = signal(false);
  private supportTimer: any = null;

  pendingQrCount = signal(0);
  operationalCounts = signal({
    incomingTransfers: 0,
    pendingTickets: 0,
    pendingComplaints: 0,
    pendingQr: 0,
    total: 0,
  });

  bellBadgeCount = computed(() => {
    const opTotal = this.operationalCounts().total;
    const support = this.unreadSupportCount();
    return opTotal + (support > 0 ? 1 : 0);
  });

  notifications = signal<any[]>([]);

  ngOnInit(): void {
    this.auth.refreshProfile();
    this.refreshSupportUnread();
    this.refreshOperationalNotifs();

    this.supportTimer = setInterval(() => {
      this.refreshSupportUnread();
      this.refreshOperationalNotifs();
    }, 10000);
  }

  cleanUserName(rawName?: string): string {
    const raw = (rawName || '').trim();
    if (!raw) return 'Admin Evergreen Mart';
    const role = (this.auth.user()?.role || '').toLowerCase();
    if (role === 'marketing' && (/marketing/i.test(raw) || raw === 'Phạm Thị Marketing')) {
      return 'Phạm Thị Hồng Hạnh';
    }
    if (role === 'sales' && (/bán hàng|sales/i.test(raw) || raw === 'Lê Thị Bán Hàng')) {
      return 'Lê Thị Thu Thảo';
    }
    if (role === 'warehouse' && (/kho|warehouse/i.test(raw) || raw === 'Nguyễn Văn Kho')) {
      return 'Nguyễn Văn Khoa';
    }
    return raw.replace(/\s*\([^)]*\)$/, '').trim();
  }

  @HostListener('window:focus')
  onWindowFocus(): void {
    this.refreshSupportUnread();
    this.refreshOperationalNotifs();
  }

  ngOnDestroy(): void {
    if (this.supportTimer) {
      clearInterval(this.supportTimer);
      this.supportTimer = null;
    }
  }

  refreshSupportUnread(): void {
    const role = (this.auth.user()?.role || '').toLowerCase();
    if (!['admin', 'sales', 'support'].includes(role)) {
      this.unreadSupportCount.set(0);
      return;
    }
    this.supportApi.getConversations().subscribe({
      next: (res) => {
        const convs = res.data || [];
        const unread = convs.reduce((sum, c) => sum + (c.unreadAdminCount || 0), 0);
        this.unreadSupportCount.set(unread);
      },
      error: () => {},
    });
  }

  refreshOperationalNotifs(): void {
    this.dashApi.getOperationalNotifications().subscribe({
      next: (res) => {
        if (res && res.success) {
          const counts = res.counts || { incomingTransfers: 0, pendingTickets: 0, pendingComplaints: 0, pendingQr: 0, total: 0 };
          this.operationalCounts.set(counts);
          this.pendingQrCount.set(counts.pendingQr || 0);

          const list: any[] = [];

          // 1. Cần duyệt gấp: Đơn VietQR chờ xác nhận thanh toán
          if (counts.pendingQr > 0) {
            const qrOrders = res.data?.pendingQrOrders || [];
            const codes = qrOrders.slice(0, 3).map((o: any) => '#' + o.orderCode).join(', ');
            list.push({
              id: 'notif-qr',
              type: 'urgent',
              isUrgent: true,
              title: `CẦN DUYỆT GẤP: ${counts.pendingQr} đơn VietQR chờ đối soát`,
              desc: `Đơn: ${codes}${qrOrders.length > 3 ? '...' : ''}. Bấm để vào duyệt tiền ngay.`,
              time: 'Khẩn cấp',
              link: '/admin/orders?filter=qr',
              actionLabel: 'Duyệt ngay',
            });
          }

          // 2. Khiếu nại khách hàng chờ xử lý
          if (counts.pendingComplaints > 0) {
            list.push({
              id: 'notif-comp',
              type: 'danger',
              title: `${counts.pendingComplaints} khiếu nại khách hàng cần giải quyết`,
              desc: 'Yêu cầu hỗ trợ đổi trả hoặc bồi hoàn từ người mua.',
              time: 'Chờ xử lý',
              link: '/admin/complaints',
              actionLabel: 'Xử lý',
            });
          }

          // 3. Chuyển kho đến (kho đích cần nhận hàng)
          if (counts.incomingTransfers > 0) {
            list.push({
              id: 'notif-transfer',
              type: 'warning',
              title: `${counts.incomingTransfers} chuyến chuyển kho đang đến`,
              desc: 'Hàng điều chuyển nội bộ đang trên đường đến chi nhánh.',
              time: 'Đang giao',
              link: '/admin/inventory',
              actionLabel: 'Kiểm đếm',
            });
          }

          // 4. Phiếu kho chờ CHT duyệt
          if (counts.pendingTickets > 0) {
            list.push({
              id: 'notif-ticket',
              type: 'info',
              title: `${counts.pendingTickets} phiếu kiểm kê / hao hụt chờ duyệt`,
              desc: 'Thủ kho đề xuất cân đối số lượng tồn kho.',
              time: 'Chờ duyệt',
              link: '/admin/inventory',
              actionLabel: 'Xem phiếu',
            });
          }

          // 5. Tin nhắn CSKH mới
          if (this.unreadSupportCount() > 0 && !this.isMarketing() && !this.isWarehouse()) {
            list.push({
              id: 'notif-msg',
              type: 'info',
              title: 'Tin nhắn hỗ trợ khách hàng',
              desc: `Có ${this.unreadSupportCount()} cuộc hội thoại đang đợi phản hồi.`,
              time: 'Vừa xong',
              link: '/admin/support',
              actionLabel: 'Trả lời',
            });
          }

          this.notifications.set(list);
        }
      },
      error: () => {},
    });
  }

  toggleNotif(event?: Event): void {
    if (event) {
      event.stopPropagation();
    }
    this.notifOpen.update((v) => !v);
  }

  closeNotif(): void {
    this.notifOpen.set(false);
  }

  isMarketing = computed(() => (this.auth.user()?.role || '').toLowerCase() === 'marketing');
  isWarehouse = computed(() => (this.auth.user()?.role || '').toLowerCase() === 'warehouse');
  isSales = computed(() => (this.auth.user()?.role || '').toLowerCase() === 'sales');

  openNotifItem(link: string): void {
    this.closeNotif();
    this.router.navigateByUrl(link);
  }
  expandedMenus = signal<Record<string, boolean>>({
    products: true,
    support: true
  });

  toggleMobileNav(): void {
    this.mobileNavOpen.update(v => !v);
  }

  closeMobileNav(): void {
    this.mobileNavOpen.set(false);
  }

  handleItemClick(item: AdminNavItem, event: Event): void {
    if (item.children && item.children.length > 0) {
      this.toggleSubmenu(item.id, event);
      if (!this.isActive(item.path)) {
        this.navigate(item.path, event);
      }
    } else {
      this.navigate(item.path, event);
      this.closeMobileNav();
    }
  }

  // Header Quick Search & Dropdown
  @ViewChild('headerSearchInput') headerSearchInput?: ElementRef<HTMLInputElement>;
  quickSearchOpen = signal(false);
  quickSearchQuery = signal('');
  quickSearchLoading = signal(false);
  quickSearchResults = signal<{ type: string; title: string; subtitle: string; path: string }[]>([]);

  @HostListener('window:keydown', ['$event'])
  onGlobalKeydown(e: KeyboardEvent): void {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'k' || e.key === 'K')) {
      e.preventDefault();
      this.openQuickSearch();
      setTimeout(() => this.headerSearchInput?.nativeElement.focus(), 50);
    } else if (e.key === 'Escape' && this.quickSearchOpen()) {
      this.closeQuickSearch();
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(e: MouseEvent): void {
    const target = e.target as HTMLElement;
    if (!target.closest('.admin-header-search-wrap')) {
      this.closeQuickSearch();
    }
    if (!target.closest('.admin-notif-wrap')) {
      this.closeNotif();
    }
  }

  toggleQuickSearch(): void {
    if (this.quickSearchOpen()) {
      this.closeQuickSearch();
    } else {
      this.openQuickSearch();
    }
  }

  openQuickSearch(): void {
    this.quickSearchOpen.set(true);
  }

  closeQuickSearch(): void {
    this.quickSearchOpen.set(false);
  }

  clearQuickSearch(): void {
    this.quickSearchQuery.set('');
    this.quickSearchResults.set([]);
    this.headerSearchInput?.nativeElement.focus();
  }

  onQuickSearchInput(val: string): void {
    this.quickSearchQuery.set(val);
    const q = val.trim().toLowerCase();
    if (!q) {
      this.quickSearchResults.set([]);
      return;
    }

    this.quickSearchLoading.set(true);
    const results: { type: string; title: string; subtitle: string; path: string }[] = [];

    // Search Products
    this.productApi.getAll({ search: q, limit: 4 }).subscribe({
      next: (res) => {
        (res.data || []).forEach(p => {
          results.push({
            type: p.isCombo ? 'Combo' : 'Sản phẩm',
            title: p.name,
            subtitle: `${p.price || ''} - Tồn kho: ${p.stock}`,
            path: p.isCombo ? '/admin/combos' : '/admin/products'
          });
        });

        // Search Orders
        this.orderApi.getAll({ search: q, limit: 4 }).subscribe({
          next: (ordRes) => {
            (ordRes.data || []).forEach(o => {
              results.push({
                type: 'Đơn hàng',
                title: `#${o.orderCode} - ${o.guestName || o.user?.name || 'Khách lẻ'}`,
                subtitle: `${(o.total || 0).toLocaleString('vi-VN')}đ - Trạng thái: ${o.status}`,
                path: '/admin/orders'
              });
            });
            this.quickSearchResults.set(results);
            this.quickSearchLoading.set(false);
          },
          error: () => {
            this.quickSearchResults.set(results);
            this.quickSearchLoading.set(false);
          }
        });
      },
      error: () => this.quickSearchLoading.set(false)
    });
  }

  goToSearchResult(path: string): void {
    this.closeQuickSearch();
    this.router.navigateByUrl(path);
  }

  readonly navSections: AdminNavSection[] = [
    {
      title: '1. TỔNG QUAN',
      items: [
        {
          id: 'dashboard',
          label: 'Bảng tổng quan',
          path: '/admin/dashboard',
        },
        {
          id: 'analytics',
          label: 'Phân tích & Hành vi',
          path: '/admin/analytics',
        },
        {
          id: 'finance',
          label: 'Quản lý tài chính',
          path: '/admin/finance',
        }
      ]
    },
    {
      title: '2. BÁN HÀNG & SẢN PHẨM',
      items: [
        {
          id: 'orders',
          label: 'Quản lý đơn hàng',
          path: '/admin/orders',
        },
        {
          id: 'products',
          label: 'Quản lý sản phẩm',
          path: '/admin/products',
          children: [
            { id: 'products-list', label: 'Danh sách sản phẩm', path: '/admin/products' },
            { id: 'products-combos', label: 'Gói combo ưu đãi', path: '/admin/combos' },
            { id: 'products-categories', label: 'Danh mục sản phẩm', path: '/admin/products', queryParam: { tab: 'categories' } }
          ]
        }
      ]
    },
    {
      title: '3. KHO HÀNG',
      items: [
        {
          id: 'inventory',
          label: 'Quản lý tồn kho',
          path: '/admin/inventory',
        },
        {
          id: 'shipping',
          label: 'Cấu hình vận chuyển',
          path: '/admin/shipping',
        }
      ]
    },
    {
      title: '4. KHÁCH HÀNG & DỊCH VỤ',
      items: [
        {
          id: 'users',
          label: 'Khách hàng',
          path: '/admin/users',
        },
        {
          id: 'reviews',
          label: 'Đánh giá & Phản hồi',
          path: '/admin/reviews',
        },
        {
          id: 'support',
          label: 'Chăm sóc khách hàng',
          path: '/admin/support',
          children: [
            { id: 'support-chat', label: 'Tin nhắn hỗ trợ', path: '/admin/support' },
            { id: 'support-reviews', label: 'Đánh giá sản phẩm', path: '/admin/reviews' },
            { id: 'support-complaints', label: 'Khiếu nại & phản hồi', path: '/admin/complaints' }
          ]
        }
      ]
    },
    {
      title: '5. MARKETING & HỆ THỐNG',
      items: [
        {
          id: 'vouchers',
          label: 'Quản lý voucher',
          path: '/admin/vouchers',
        },
        {
          id: 'banners',
          label: 'Banner & Pop-up',
          path: '/admin/banners',
        },
        {
          id: 'staff',
          label: 'Tài khoản & Phân quyền',
          path: '/admin/staff',
        },
        {
          id: 'audit-log',
          label: 'Nhật ký hệ thống',
          path: '/admin/audit-log',
        }
      ]
    }
  ];

  filteredNavSections = computed(() => {
    const rawRole = (this.auth.user()?.role || '').toLowerCase();
    const role = (rawRole === 'content' ? 'marketing' : rawRole);
    const isSales = role === 'sales';
    const isMarketing = role === 'marketing';

    return this.navSections
      .map(sec => {
        let secTitle = sec.title;
        if (isSales && secTitle?.includes('MARKETING & HỆ THỐNG')) {
          secTitle = '5. KHUYẾN MÃI & ƯU ĐÃI';
        }
        if (isMarketing && secTitle?.includes('KHÁCH HÀNG & DỊCH VỤ')) {
          secTitle = '4. KHÁCH HÀNG & TRUYỀN THÔNG';
        }
        if (isMarketing && secTitle?.includes('MARKETING & HỆ THỐNG')) {
          secTitle = '5. MARKETING & KHUYẾN MÃI';
        }

        const items = sec.items
          .filter(item => this.canAccessNavItem(item.id, role))
          .map(item => {
            // Tùy biến thuật ngữ cho Sales: Không dùng từ "Quản lý" khi nhân viên chỉ tra cứu và xử lý nghiệp vụ
            let label = item.label;
            if (role === 'manager' && item.id === 'finance') {
              label = 'Tài chính Cửa hàng';
            }
            if (isSales) {
              if (item.id === 'orders') label = 'Xử lý đơn hàng';
              else if (item.id === 'products') label = 'Tra cứu sản phẩm & Combo';
              else if (item.id === 'inventory') label = 'Tra cứu tồn kho chi nhánh';
              else if (item.id === 'vouchers') label = 'Tra cứu mã giảm giá (Voucher)';
              else if (item.id === 'users') label = 'Tra cứu thông tin khách hàng';
            }
            if (isMarketing) {
              if (item.id === 'reviews') label = 'Đánh giá & Phản hồi';
              else if (item.id === 'banners') label = 'Banner & Pop-up';
            }

            if (item.children) {
              const children = item.children
                .filter(ch => {
                  // Cửa hàng trưởng: Bỏ "Tin nhắn hỗ trợ" (Live Chat trực tuyến web đưa hết về cho Sales/CSKH chuyên trách xử lý, tránh chồng chéo)
                  if (role === 'manager' && ch.id === 'support-chat') return false;
                  return true;
                })
                .map(ch => {
                  if (isSales && ch.id === 'products-list') {
                    return { ...ch, label: 'Danh sách sản phẩm & Bảng giá' };
                  }
                  return ch;
                });

              // Nếu sau khi lọc chỉ có 1 mục con hoặc không có, làm phẳng (flatten) thành link trực tiếp, không phân cấp accordion
              if (children.length <= 1) {
                return {
                  ...item,
                  label,
                  path: children[0]?.path || item.path,
                  children: undefined,
                };
              }
              return { ...item, label, children };
            }
            return { ...item, label };
          });
        return { ...sec, title: secTitle, items };
      })
      .filter(sec => sec.items.length > 0);
  });

  canAccessNavItem(itemId: string, role: string): boolean {
    // 1. Admin tối cao: Toàn quyền điều hành toàn bộ hệ thống
    if (role === 'admin') {
      if (itemId === 'reviews') return false; // Đã nằm trong menu Chăm sóc khách hàng
      return true;
    }

    switch (role) {
      case 'manager':
        // 2. Cửa hàng trưởng (Store Manager): Giới hạn tại cơ sở/chi nhánh phụ trách
        // Bao gồm: Bảng tổng quan chi nhánh, Tài chính Cửa hàng, Quản lý đơn hàng, Tra cứu sản phẩm & bảng giá, Quản lý tồn kho chi nhánh, Khách hàng & CSKH
        return ['dashboard', 'finance', 'orders', 'products', 'inventory', 'users', 'support'].includes(itemId);

      case 'sales':
        // 3. Sales: Tiếp nhận & xử lý đơn hàng, CSKH, xử lý khiếu nại, tra cứu tồn kho từng chi nhánh, tra cứu giá/combo/voucher để tư vấn khách
        return ['dashboard', 'orders', 'support', 'products', 'inventory', 'users', 'vouchers'].includes(itemId);

      case 'warehouse':
        // 4. Warehouse: Bảng tổng quan, Quản lý tồn kho, Cấu hình vận chuyển, Đơn hàng (đóng gói & in phiếu)
        return ['dashboard', 'inventory', 'shipping', 'orders'].includes(itemId);

      case 'marketing':
        // 5. Marketing: Phân tích & Hành vi (Performance Dashboard), Bảng tổng quan, Quản lý sản phẩm, Quản lý voucher, Phân nhóm khách hàng, Đánh giá, Banner
        return ['analytics', 'dashboard', 'products', 'vouchers', 'banners', 'reviews', 'users'].includes(itemId);

      default:
        return false;
    }
  }

  isActive(item: AdminNavItem | string): boolean {
    const current = this.router.url.split('?')[0];
    const path = typeof item === 'string' ? item : item.path;
    if (typeof item !== 'string' && item.children) {
      if (item.children.some(ch => current === ch.path || current.startsWith(ch.path + '/'))) {
        return true;
      }
    }
    return current === path || current.startsWith(path + '/');
  }

  isSubActive(sub: AdminNavSubItem): boolean {
    const url = this.router.url;
    if (sub.queryParam) {
      const entries = Object.entries(sub.queryParam);
      return entries.every(([k, v]) => url.includes(`${k}=${v}`));
    }
    const current = url.split('?')[0];
    return current === sub.path && !url.includes('tab=');
  }

  isMenuExpanded(id: string): boolean {
    return !!this.expandedMenus()[id];
  }

  toggleSubmenu(id: string, event?: Event): void {
    if (event) {
      event.preventDefault();
      event.stopPropagation();
    }
    this.expandedMenus.update(m => ({ ...m, [id]: !m[id] }));
  }

  navigate(path: string, event?: Event, queryParams?: Record<string, string>): void {
    if (event) {
      event.preventDefault();
    }
    this.router.navigate([path], { queryParams });
  }

  toggleSidebar(): void {
    this.sidebarOpen.update(v => !v);
  }

  logout(): void {
    this.auth.logout();
  }

  openStorefront(): void {
    window.open('http://localhost:4200', '_blank');
  }
}
