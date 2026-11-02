import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ShellComponent } from '../../components/shell/shell.component';
import { Router, RouterLink } from '@angular/router';

export interface PromoItem {
  id: string;
  icon: string;
  title: string;
  desc: string;
  badge: string;
  expiry: string;
  tag: string;
  cta: string;
  code?: string;
  color: 'green' | 'amber' | 'teal' | 'rose';
  action: 'vouchers' | 'loyalty' | 'shop' | 'nutrition';
  queryParams?: Record<string, string>;
}

@Component({
  selector: 'app-promotions',
  standalone: true,
  imports: [CommonModule, ShellComponent, RouterLink],
  templateUrl: './promotions.component.html',
  styleUrl: './promotions.component.css',
})
export class PromotionsComponent {
  private router = inject(Router);

  activeTab = signal<'vouchers' | 'points'>('vouchers');
  copiedCode = signal<string | null>(null);

  readonly promotions: PromoItem[] = [
    {
      id: 'new-member',
      icon: '🌱',
      title: 'Ưu đãi thành viên mới',
      desc: 'Giảm 20% cho đơn hàng đầu tiên. Thu thập mã tại Ví Voucher và áp dụng cho mọi nông sản tươi sạch.',
      badge: 'HOT',
      expiry: 'Hết hạn: 31/12/2026',
      tag: 'Voucher thành viên',
      cta: 'Săn voucher ngay',
      code: 'XANHLA20',
      color: 'green',
      action: 'vouchers',
    },
    {
      id: 'weekend-sale',
      icon: '🛒',
      title: 'Flash Sale cuối tuần',
      desc: 'Giảm đến 50% rau củ quả tươi hữu cơ mỗi thứ Bảy & Chủ Nhật. Số lượng giới hạn trong ngày!',
      badge: 'LTD',
      expiry: 'Mỗi cuối tuần',
      tag: 'Rau củ quả',
      cta: 'Khám phá ngay',
      color: 'amber',
      action: 'shop',
      queryParams: { category: 'Rau củ' },
    },
    {
      id: 'loyalty-bonus',
      icon: '⭐',
      title: 'Nhân đôi điểm thưởng',
      desc: 'Tích điểm x2 cho mọi đơn hàng trong tháng 11. Đổi điểm lấy phiếu mua hàng và quà hấp dẫn!',
      badge: 'NEW',
      expiry: 'Hết hạn: 30/11/2026',
      tag: 'Chương trình điểm',
      cta: 'Tích điểm ngay',
      color: 'teal',
      action: 'loyalty',
    },
    {
      id: 'combo-deal',
      icon: '🥗',
      title: 'Combo dinh dưỡng thông minh',
      desc: 'Lên thực đơn cá nhân hóa tại trang Dinh dưỡng thông minh và mua trọn gói nguyên liệu tiết kiệm thêm 10%.',
      badge: 'SMART',
      expiry: 'Không giới hạn',
      tag: 'Dinh dưỡng thông minh',
      cta: 'Tạo thực đơn',
      color: 'rose',
      action: 'nutrition',
    },
  ];

  setTab(tab: 'vouchers' | 'points'): void {
    this.activeTab.set(tab);
  }

  copyPromoCode(code: string, event: Event): void {
    event.stopPropagation();
    navigator.clipboard?.writeText(code);
    this.copiedCode.set(code);
    setTimeout(() => {
      if (this.copiedCode() === code) {
        this.copiedCode.set(null);
      }
    }, 2000);
  }

  goToVouchers(): void {
    this.router.navigate(['/vouchers']);
  }

  goToLoyalty(): void {
    this.router.navigate(['/loyalty']);
  }

  handlePromoAction(promo: PromoItem): void {
    if (promo.action === 'vouchers') {
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
