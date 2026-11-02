import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ShellComponent } from '../../components/shell/shell.component';
import { Router, RouterLink } from '@angular/router';
import { VoucherRecord, VoucherService } from '../../shared/services/voucher.service';
import { CartService } from '../../shared/services/cart.service';

export interface PromoItem {
  id: string;
  voucherId?: string;
  icon: string;
  title: string;
  desc: string;
  badge: string;
  expiry: string;
  tag: string;
  cta: string;
  code: string;
  minOrderValue: number;
  discountText: string;
  color: 'green' | 'amber' | 'teal' | 'rose';
  action: 'vouchers' | 'loyalty' | 'shop' | 'nutrition' | 'checkout';
  queryParams?: Record<string, string>;
}

const CARD_THEMES: { icon: string; badge: string; tag: string; color: 'green' | 'amber' | 'teal' | 'rose' }[] = [
  { icon: '🌱', badge: 'HOT', tag: 'Ưu đãi nổi bật', color: 'green' },
  { icon: '🛒', badge: 'SALE', tag: 'Rau củ hữu cơ', color: 'amber' },
  { icon: '🚚', badge: 'FREE', tag: 'Miễn phí vận chuyển', color: 'teal' },
  { icon: '🥗', badge: 'SMART', tag: 'Thực đơn dinh dưỡng', color: 'rose' },
];

@Component({
  selector: 'app-promotions',
  standalone: true,
  imports: [CommonModule, ShellComponent, RouterLink],
  templateUrl: './promotions.component.html',
  styleUrl: './promotions.component.css',
})
export class PromotionsComponent implements OnInit {
  private router = inject(Router);
  protected voucher = inject(VoucherService);
  protected cart = inject(CartService);

  activeTab = signal<'vouchers' | 'points'>('vouchers');
  walletFilter = signal<'all' | 'saved'>('all');
  toastMessage = signal<string>('');
  private pendingVoucherId = signal<string | null>(null);

  // Dynamically computed promotions from MongoDB vouchers
  readonly promotions = computed<PromoItem[]>(() => {
    const list = this.voucher.publicVouchers();
    return list.map((v, idx) => {
      const theme = CARD_THEMES[idx % CARD_THEMES.length];
      const isPercent = v.discountType === 'percentage' || v.discountType === 'percent';
      const discountText = isPercent
        ? `Giảm ${v.discountValue}%`
        : `Giảm ${v.discountValue.toLocaleString('vi-VN')}đ`;
      const endDateStr = v.endDate ? new Date(v.endDate).toLocaleDateString('vi-VN') : '31/12/2027';

      return {
        id: v._id,
        voucherId: v._id,
        icon: theme.icon,
        title: v.name,
        desc: v.description || `${discountText} cho đơn hàng từ ${(v.minOrderValue || 0).toLocaleString('vi-VN')}đ.`,
        badge: isPercent ? `-${v.discountValue}%` : `-${Math.round(v.discountValue / 1000)}K`,
        expiry: `HSD: ${endDateStr}`,
        tag: `Đơn từ ${(v.minOrderValue || 0).toLocaleString('vi-VN')}đ`,
        cta: 'Dùng ưu đãi này',
        code: v.code,
        minOrderValue: v.minOrderValue || 0,
        discountText,
        color: theme.color,
        action: 'checkout',
        queryParams: { voucher: v.code },
      };
    });
  });

  readonly filteredWalletVouchers = computed<VoucherRecord[]>(() => {
    if (this.walletFilter() === 'saved') {
      return this.voucher.availableVouchers().map(uv => uv.voucher);
    }
    return this.voucher.publicVouchers();
  });

  constructor() {
    effect(() => {
      const user = this.cart.currentUser();
      const pendingId = this.pendingVoucherId();
      if (user && pendingId && localStorage.getItem('xanhla_auth_token')) {
        this.pendingVoucherId.set(null);
        this.persistVoucher(pendingId);
      }
    });
  }

  ngOnInit(): void {
    this.voucher.loadPublicVouchers();
    this.voucher.loadUserVouchers();
  }

  setTab(tab: 'vouchers' | 'points'): void {
    this.activeTab.set(tab);
  }

  isCopied(code: string): boolean {
    return this.voucher.isCopied(code);
  }

  isSaved(voucherId?: string): boolean {
    if (!voucherId) return false;
    return this.voucher.isSaved(voucherId);
  }

  copyPromoCode(code: string, event: Event): void {
    event.stopPropagation();
    this.voucher.copyCode(code);
    this.showToast(`Đã sao chép mã ${code}! Bạn có thể dán hoặc chọn trực tiếp khi thanh toán.`);
  }

  savePromoVoucher(voucherId: string | undefined, event: Event): void {
    event.stopPropagation();
    if (!voucherId) return;
    if (this.isSaved(voucherId)) return;

    if (!this.cart.currentUser() || !localStorage.getItem('xanhla_auth_token')) {
      this.pendingVoucherId.set(voucherId);
      this.cart.openAuthModal('login');
      return;
    }
    this.persistVoucher(voucherId);
  }

  private persistVoucher(voucherId: string): void {
    this.voucher.saveVoucher(voucherId).subscribe({
      next: res => {
        this.showToast(`Đã lưu mã ${res.data.voucher.code} vào Ví Voucher của bạn!`);
      },
      error: err => {
        if (err.status === 401) {
          this.pendingVoucherId.set(voucherId);
          this.cart.openAuthModal('login');
          return;
        }
        if (err.status === 400 && err.error?.message?.includes('đã lưu')) {
          this.voucher.loadUserVouchers();
          this.showToast('Mã ưu đãi này đã có trong ví của bạn.');
          return;
        }
        this.showToast(err.error?.message || 'Không thể lưu voucher lúc này.');
      },
    });
  }

  private showToast(msg: string): void {
    this.toastMessage.set(msg);
  }

  goToVouchers(): void {
    this.router.navigate(['/vouchers']);
  }

  goToLoyalty(): void {
    this.router.navigate(['/loyalty']);
  }

  handlePromoAction(promo: PromoItem): void {
    if (promo.action === 'checkout') {
      this.router.navigate(['/checkout'], {
        queryParams: promo.queryParams || { voucher: promo.code },
      });
    } else if (promo.action === 'vouchers') {
      this.router.navigate(['/vouchers']);
    } else if (promo.action === 'loyalty') {
      this.router.navigate(['/loyalty']);
    } else if (promo.action === 'nutrition') {
      this.router.navigate(['/nutrition']);
    } else {
      this.router.navigate(['/online-ordering'], {
        queryParams: promo.queryParams || {},
      });
    }
  }
}
