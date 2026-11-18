import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ShellComponent } from '../../components/shell/shell.component';
import { VoucherService } from '../../shared/services/voucher.service';
import { CartService } from '../../shared/services/cart.service';
import { OrderApiService } from '../../shared/services/order-api.service';
import { Voucher, UserVoucher } from '../../shared/models/xanh-la.models';
import {
  buildVoucherVisual,
  formatVoucherDateVi,
  VoucherCardVisual,
} from '../../shared/utils/voucher-visual.util';

export interface VoucherTicketView {
  voucher: Voucher;
  visual: VoucherCardVisual;
  expiryFormatted: string;
  statusInfo: { label: string; type: 'available' | 'used' | 'expired' | 'uncollected' };
  timeWindow: { valid: boolean; statusLabel?: string };
}

@Component({
  selector: 'app-vouchers',
  standalone: true,
  imports: [CommonModule, ShellComponent, RouterLink],
  templateUrl: './vouchers.component.html',
  styleUrl: './vouchers.component.css',
})
export class VouchersComponent implements OnInit {
  protected voucher = inject(VoucherService);
  protected cart = inject(CartService);
  protected orderApi = inject(OrderApiService);

  activeTab = signal<'all' | 'available' | 'collected'>('all');
  toastMessage = signal<string>('');
  toastType = signal<'success' | 'error' | 'info'>('success');
  readonly hasPriorValidOrders = signal<boolean>(false);
  private toastTimer: any = null;

  readonly publicVouchers = this.voucher.publicVouchers;
  readonly collectedVouchers = this.voucher.userVouchers;
  readonly isLoading = this.voucher.isLoading;

  private isFirstOrderOnly(v: Voucher): boolean {
    const code = (v.code || '').toUpperCase();
    const desc = `${v.name || ''} ${v.description || ''}`.toLowerCase();
    return (
      Boolean(v.isFirstOrderOnly) ||
      code.startsWith('WELCOME') ||
      desc.includes('đơn hàng đầu tiên') ||
      desc.includes('thành viên mới')
    );
  }

  readonly uncollectedCount = computed(() =>
    this.filteredPublicVouchers().filter(v => !this.voucher.isSaved(v.id)).length
  );
  readonly savedCount = computed(() => this.collectedVouchers().length);

  readonly filteredPublicVouchers = computed<Voucher[]>(() => {
    return this.publicVouchers().filter(v => {
      // Nếu là mã chỉ dành riêng cho đơn đầu nhưng khách đã có đơn hàng hợp lệ -> tự động ẩn
      if (this.isFirstOrderOnly(v) && this.hasPriorValidOrders()) {
        return false;
      }
      return true;
    });
  });

  readonly tabVouchers = computed<Voucher[]>(() => {
    switch (this.activeTab()) {
      case 'available':
        return this.filteredPublicVouchers().filter(v => !this.isCollected(v.id));
      case 'collected':
        return this.collectedVouchers().map(uv => uv.voucher);
      case 'all':
      default:
        return this.filteredPublicVouchers();
    }
  });

  readonly ticketViews = computed<VoucherTicketView[]>(() =>
    this.tabVouchers().map((v, index) => ({
      voucher: v,
      visual: buildVoucherVisual(v, index),
      expiryFormatted: formatVoucherDateVi(v.endDate),
      statusInfo: this.getVoucherStatus(v.id),
      timeWindow: this.voucher.checkTimeWindow(v),
    }))
  );

  ngOnInit(): void {
    this.voucher.loadPublic();
    this.voucher.refreshMine();
    if (this.cart.currentUser()) {
      this.orderApi.getMyOrders({ limit: 5 }).subscribe({
        next: (res: any) => {
          if (res && Array.isArray(res.data)) {
            const valid = res.data.filter((o: any) => o.status !== 'cancelled');
            this.hasPriorValidOrders.set(valid.length > 0);
          }
        },
      });
    }
  }

  isCollected(voucherId: string): boolean {
    return this.voucher.isSaved(voucherId);
  }

  getVoucherStatus(voucherId: string): { label: string; type: 'available' | 'used' | 'expired' | 'uncollected' } {
    const saved = this.voucher.getUserVoucher(voucherId);
    if (!saved) {
      return { label: 'Chưa lưu vào ví', type: 'uncollected' };
    }
    if (saved.status === 'used') {
      return { label: 'Đã sử dụng', type: 'used' };
    }
    if (saved.status === 'expired') {
      return { label: 'Đã hết hạn', type: 'expired' };
    }
    return { label: 'Đã lưu trong ví (Khả dụng)', type: 'available' };
  }

  isCopied(code: string): boolean {
    return this.voucher.isCopied(code);
  }

  copyCode(code: string, event?: Event): void {
    event?.stopPropagation();
    this.voucher.copyCode(code);
    this.showToast(`Đã sao chép mã "${code}" thành công! Bạn có thể dán vào ô voucher khi thanh toán.`, 'success');
  }

  collectVoucher(voucherId: string, event?: Event): void {
    event?.stopPropagation();
    this.voucher.collectVoucher(voucherId).subscribe((res) => {
      if (res.success) {
        this.showToast('Đã lưu voucher vào Ví của bạn! Mã sẵn sàng dùng khi thanh toán.', 'success');
      } else {
        this.showToast(res.message || 'Không thể thu thập voucher.', 'error');
      }
    });
  }

  showToast(message: string, type: 'success' | 'error' | 'info' = 'success'): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastMessage.set(message);
    this.toastType.set(type);
    this.toastTimer = setTimeout(() => {
      this.toastMessage.set('');
    }, 4500);
  }

  closeToast(): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastMessage.set('');
  }
}
