import { Component, signal, inject, HostListener, ViewChild, ElementRef } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminAuthService } from '../../shared/services/admin-auth.service';
import { ProductApiService } from '../../shared/services/product-api.service';
import { OrderApiService } from '../../shared/services/order-api.service';
import { UserApiService } from '../../shared/services/user-api.service';

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
  imports: [CommonModule, FormsModule, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './admin-layout.component.html',
  styleUrl: './admin-layout.component.css',
})
export class AdminLayoutComponent {
  protected auth       = inject(AdminAuthService);
  protected router     = inject(Router);
  private productApi   = inject(ProductApiService);
  private orderApi     = inject(OrderApiService);
  private userApi      = inject(UserApiService);

  sidebarOpen = signal(true);
  expandedMenus = signal<Record<string, boolean>>({
    products: true,
    support: true
  });

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
          id: 'staff',
          label: 'Tài khoản & Phân quyền',
          path: '/admin/staff',
        }
      ]
    }
  ];

  isActive(path: string): boolean {
    const current = this.router.url.split('?')[0];
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
