import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ShellComponent } from '../../components/shell/shell.component';
import { VoucherService } from '../../shared/services/voucher.service';
import { CartService } from '../../shared/services/cart.service';
import { Voucher, UserVoucher } from '../../shared/models/xanh-la.models';

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

  activeTab = signal<'all' | 'available' | 'collected'>('all');
  toastMessage = signal<string>('');
  toastType = signal<'success' | 'error' | 'info'>('success');
  private toastTimer: any = null;

  readonly publicVouchers = this.voucher.publicVouchers;
  readonly collectedVouchers = this.voucher.userVouchers;
  readonly isLoading = this.voucher.isLoading;

  readonly uncollectedCount = computed(() =>
    this.publicVouchers().filter(v => !this.voucher.isSaved(v.id)).length
  );
  readonly savedCount = computed(() => this.collectedVouchers().length);

  readonly tabVouchers = computed<Voucher[]>(() => {
    switch (this.activeTab()) {
      case 'available':
        return this.publicVouchers().filter(v => !this.isCollected(v.id));
      case 'collected':
        return this.collectedVouchers().map(uv => uv.voucher);
      case 'all':
      default:
        return this.publicVouchers();
    }
  });

  ngOnInit(): void {
    this.voucher.loadPublic();
    this.voucher.refreshMine();
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
        this.showToast('✓ Đã lưu voucher vào Ví của bạn! Mã sẵn sàng dùng khi thanh toán.', 'success');
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
