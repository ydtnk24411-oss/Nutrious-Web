import { Component, signal, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AdminAuthService } from '../../shared/services/admin-auth.service';

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
  imports: [CommonModule, RouterLink, RouterLinkActive, RouterOutlet],
  templateUrl: './admin-layout.component.html',
  styleUrl: './admin-layout.component.css',
})
export class AdminLayoutComponent {
  protected auth   = inject(AdminAuthService);
  protected router = inject(Router);

  sidebarOpen = signal(true);
  expandedMenus = signal<Record<string, boolean>>({
    products: true,
    support: true
  });

  readonly navSections: AdminNavSection[] = [
    {
      title: '1. TỔNG QUAN',
      items: [
        {
          id: 'dashboard',
          label: 'Bảng tổng quan',
          path: '/admin/dashboard',
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
        },
        {
          id: 'combos',
          label: 'Quản lý Combo tiết kiệm',
          path: '/admin/combos',
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
