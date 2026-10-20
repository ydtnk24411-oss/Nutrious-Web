import { Component, signal, inject, HostListener } from '@angular/core';
import { RouterLink, Router } from '@angular/router';
import { CommonModule } from '@angular/common';
import { CartService } from '../../shared/services/cart.service';
import { navItems, logoImage } from '../../shared/data/xanh-la.data';

const CATEGORIES = [
  { label: 'Rau củ tươi',           path: '/online-ordering' },
  { label: 'Trái cây',              path: '/online-ordering' },
  { label: 'Thịt & Hải sản',        path: '/online-ordering' },
  { label: 'Thực phẩm chế biến',    path: '/online-ordering' },
  { label: 'Gia vị & Thảo mộc',     path: '/online-ordering' },
  { label: 'Sữa & Trứng',           path: '/online-ordering' },
  { label: 'Đồ uống',               path: '/online-ordering' },
  { label: 'Thực phẩm hữu cơ',      path: '/online-ordering' },
];

const AREAS = ['TP. Hồ Chí Minh', 'Hà Nội', 'Đà Nẵng', 'Cần Thơ', 'Biên Hòa'];

const NOTIFICATIONS = [
  { id: 'n1', title: 'Đơn hàng đang giao', body: 'Đơn #XL-2408 sẽ đến trong hôm nay.', path: '/tracker-page', unread: true },
  { id: 'n2', title: 'Voucher XANHLA30', body: 'Mã chào bạn mới còn hạn 10 ngày.', path: '/online-ordering', unread: true },
  { id: 'n3', title: 'Rau củ hữu cơ -40%', body: 'Flash sale cuối tuần đang diễn ra.', path: '/online-ordering', unread: false },
];

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

  protected readonly navItems    = navItems;
  protected readonly logoImage   = logoImage;
  protected readonly categories    = CATEGORIES;
  protected readonly areas         = AREAS;
  protected readonly notifications = NOTIFICATIONS;

  protected mobileMenuOpen  = signal(false);
  protected userMenuOpen    = signal(false);
  protected catMenuOpen     = signal(false);
  protected areaMenuOpen    = signal(false);
  protected notifMenuOpen   = signal(false);
  protected selectedArea    = signal('TP. Hồ Chí Minh');
  protected copiedCode      = signal<string | null>(null);

  protected unreadCount(): number {
    return this.notifications.filter(n => n.unread).length;
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
