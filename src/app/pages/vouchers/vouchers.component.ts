import { Component, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ShellComponent } from '../../components/shell/shell.component';
import { VoucherService } from '../../shared/services/voucher.service';
import { CartService } from '../../shared/services/cart.service';

@Component({
  selector: 'app-vouchers',
  standalone: true,
  imports: [CommonModule, ShellComponent],
  templateUrl: './vouchers.component.html',
  styleUrl: './vouchers.component.css',
})
export class VouchersComponent {
  protected voucher = inject(VoucherService);
  protected cart = inject(CartService);

  activeTab = signal<'available' | 'collected' | 'all'>('all');

  readonly publicVouchers = this.voucher.publicVouchers;
  readonly collectedVouchers = this.voucher.userVouchers;

  readonly tabVouchers = computed(() => {
    switch (this.activeTab()) {
      case 'available':
        return this.publicVouchers().filter(v => v.isPublic);
      case 'collected':
        return this.collectedVouchers().filter(uv => uv.status === 'available').map(uv => uv.voucher);
      case 'all':
        return this.publicVouchers();
      default:
        return this.publicVouchers();
    }
  });

  isCollected(voucherId: string): boolean {
    return this.collectedVouchers().some(uv => uv.voucherId === voucherId);
  }

  collectVoucher(voucherId: string): void {
    this.voucher.collectVoucher(voucherId).subscribe((res) => {
      alert(res.success ? 'Đã thu thập voucher thành công!' : (res.message || 'Không thể thu thập voucher.'));
    });
  }
}
