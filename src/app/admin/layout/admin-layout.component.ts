import { Component, signal, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AdminAuthService } from '../../shared/services/admin-auth.service';

export interface AdminNavItem {
  id: 'dashboard' | 'orders' | 'products' | 'users' | 'events' | 'bookings';
  label: string;
  path: string;
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

  readonly navSections: AdminNavSection[] = [
    {
      title: 'TỔNG QUAN',
      items: [
        {
          id: 'dashboard',
          label: 'Bảng tổng quan',
          path: '/admin/dashboard',
        }
      ]
    },
    {
      title: 'BÁN HÀNG & SẢN PHẨM',
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
        }
      ]
    },
    {
      title: 'QUẢN TRỊ & DỊCH VỤ',
      items: [
        {
          id: 'users',
          label: 'Khách hàng',
          path: '/admin/users',
        },
        {
          id: 'events',
          label: 'Sự kiện nông trại',
          path: '/admin/events',
        },
        {
          id: 'bookings',
          label: 'Đặt lịch trải nghiệm',
          path: '/admin/bookings',
        }
      ]
    }
  ];

  isActive(path: string): boolean {
    const current = this.router.url.split('?')[0];
    return current === path || current.startsWith(path + '/');
  }

  navigate(path: string, event?: Event): void {
    if (event) {
      event.preventDefault();
    }
    this.router.navigateByUrl(path);
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
