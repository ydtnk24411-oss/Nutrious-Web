import { Component, signal, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AdminAuthService } from '../../shared/services/admin-auth.service';

export interface AdminNavItem {
  label: string;
  path: string;
  svgIcon: string;
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
          label: 'Bảng tổng quan',
          path: '/admin/dashboard',
          svgIcon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect width="7" height="9" x="3" y="3" rx="1"/>
            <rect width="7" height="5" x="14" y="3" rx="1"/>
            <rect width="7" height="9" x="14" y="12" rx="1"/>
            <rect width="7" height="5" x="3" y="16" rx="1"/>
          </svg>`
        }
      ]
    },
    {
      title: 'BÁN HÀNG & SẢN PHẨM',
      items: [
        {
          label: 'Quản lý đơn hàng',
          path: '/admin/orders',
          svgIcon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z"/>
            <path d="M3 6h18"/>
            <path d="M16 10a4 4 0 0 1-8 0"/>
          </svg>`
        },
        {
          label: 'Danh mục sản phẩm',
          path: '/admin/products',
          svgIcon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/>
            <path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/>
          </svg>`
        }
      ]
    },
    {
      title: 'QUẢN TRỊ & DỊCH VỤ',
      items: [
        {
          label: 'Khách hàng',
          path: '/admin/users',
          svgIcon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/>
            <circle cx="9" cy="7" r="4"/>
            <path d="M22 21v-2a4 4 0 0 0-3-3.87"/>
            <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>`
        },
        {
          label: 'Sự kiện nông trại',
          path: '/admin/events',
          svgIcon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect width="18" height="18" x="3" y="4" rx="2" ry="2"/>
            <line x1="16" x2="16" y1="2" y2="6"/>
            <line x1="8" x2="8" y1="2" y2="6"/>
            <line x1="3" x2="21" y1="10" y2="10"/>
            <path d="m9 16 2 2 4-4"/>
          </svg>`
        },
        {
          label: 'Đặt lịch trải nghiệm',
          path: '/admin/bookings',
          svgIcon: `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"/>
            <polyline points="12 6 12 12 16 14"/>
          </svg>`
        }
      ]
    }
  ];

  toggleSidebar(): void { this.sidebarOpen.update(v => !v); }
  logout(): void        { this.auth.logout(); }

  openStorefront(): void {
    window.open('http://localhost:4200', '_blank');
  }
}
