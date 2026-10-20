import { Component, signal, inject } from '@angular/core';
import { RouterLink, RouterLinkActive, RouterOutlet, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { AdminAuthService } from '../../shared/services/admin-auth.service';

interface NavItem {
  label: string;
  svgIcon: string;
  path: string;
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

  readonly navItems: NavItem[] = [
    {
      label: 'Tổng quan',
      svgIcon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>',
      path: '/admin/dashboard'
    },
    {
      label: 'Đơn hàng',
      svgIcon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>',
      path: '/admin/orders'
    },
    {
      label: 'Sản phẩm',
      svgIcon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 2C7.03 2 3 6.03 3 11c0 3.94 2.56 7.3 6.09 8.7 1.54.63 3.28.63 4.82 0C17.44 18.3 20 14.94 20 11c0-4.97-4.03-9-9-9z"/><path d="M12 5c-2.76 0-5 2.24-5 5 0 1.5.67 2.85 1.73 3.77"/></svg>',
      path: '/admin/products'
    },
    {
      label: 'Khách hàng',
      svgIcon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
      path: '/admin/users'
    },
    {
      label: 'Sự kiện',
      svgIcon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>',
      path: '/admin/events'
    },
    {
      label: 'Đặt lịch',
      svgIcon: '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><line x1="17" y1="14" x2="23" y2="14"/><line x1="17" y1="18" x2="23" y2="18"/><line x1="3" y1="14" x2="21" y2="14"/><line x1="3" y1="18" x2="21" y2="18"/><line x1="9" y1="18" x2="9" y2="14"/><line x1="15" y1="18" x2="15" y2="14"/></svg>',
      path: '/admin/bookings'
    },
  ];

  toggleSidebar(): void { this.sidebarOpen.update(v => !v); }
  logout(): void        { this.auth.logout(); }
}
