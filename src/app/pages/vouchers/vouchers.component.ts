import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ShellComponent } from '../../components/shell/shell.component';
import { VoucherService } from '../../shared/services/voucher.service';
import { CartService } from '../../shared/services/cart.service';
import { Voucher } from '../../shared/models/xanh-la.models';

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

  readonly publicVouchers = this.voucher.publicVouchers;
  readonly collectedVouchers = this.voucher.userVouchers;
  readonly availableWalletVouchers = this.voucher.availableVouchers;

  readonly tabVouchers = computed<Voucher[]>(() => {
    switch (this.activeTab()) {
      case 'available':
        return this.publicVouchers().filter(v => !this.isCollected(v.id));
      case 'collected':
        return this.availableWalletVouchers().map(uv => uv.voucher);
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

  isCopied(code: string): boolean {
    return this.voucher.isCopied(code);
  }

  copyCode(code: string, event?: Event): void {
    event?.stopPropagation();
    this.voucher.copyCode(code);
    this.toastMessage.set(`Đã sao chép mã ${code}! Mã luôn hiển thị trên thẻ và có thể chọn trực tiếp khi thanh toán.`);
  }

  collectVoucher(voucherId: string, event?: Event): void {
    event?.stopPropagation();
    this.voucher.collectVoucher(voucherId).subscribe((res) => {
      if (res.success) {
        this.toastMessage.set('Đã lưu voucher vào Ví Voucher của bạn! Bạn có thể chọn trực tiếp ở trang Thanh toán.');
      } else {
        this.toastMessage.set(res.message || 'Không thể thu thập voucher.');
      }
    });
  }
}
