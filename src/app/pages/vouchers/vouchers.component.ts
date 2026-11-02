import { Component, OnInit, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ShellComponent } from '../../components/shell/shell.component';
import { CartService } from '../../shared/services/cart.service';
import { VoucherRecord, VoucherService } from '../../shared/services/voucher.service';

@Component({
  selector: 'app-vouchers',
  standalone: true,
  imports: [CommonModule, ShellComponent, RouterLink],
  templateUrl: './vouchers.component.html',
  styleUrl: './vouchers.component.css',
})
export class VouchersComponent implements OnInit {
  protected cart = inject(CartService);
  protected voucher = inject(VoucherService);

  activeTab = signal<'available' | 'collected' | 'all'>('all');
  saveMessage = signal('');
  private pendingVoucherId = signal<string | null>(null);

  readonly tabVouchers = computed(() => {
    const tab = this.activeTab();
    if (tab === 'collected') {
      return this.voucher.availableVouchers().map(item => item.voucher);
    }
    if (tab === 'available') {
      return this.voucher.publicVouchers().filter(v => !this.isCollected(v._id));
    }
    return this.voucher.publicVouchers();
  });

  constructor() {
    effect(() => {
      const user = this.cart.currentUser();
      const voucherId = this.pendingVoucherId();
      if (!user || !voucherId) return;
      if (localStorage.getItem('xanhla_auth_token')) {
        this.pendingVoucherId.set(null);
        this.saveToWallet(voucherId);
      }
    });
  }

  ngOnInit(): void {
    this.voucher.loadPublicVouchers();
    this.voucher.loadUserVouchers();
  }

  isCollected(voucherId: string): boolean {
    return this.voucher.userVouchers().some(item => item.voucher?._id === voucherId);
  }

  isCopied(code: string): boolean {
    return this.voucher.isCopied(code);
  }

  copyVoucherCode(code: string): void {
    this.voucher.copyCode(code);
    this.saveMessage.set(`Đã sao chép mã ${code} vào bộ nhớ tạm!`);
  }

  collectVoucher(v: VoucherRecord): void {
    if (!this.cart.currentUser() || !localStorage.getItem('xanhla_auth_token')) {
      this.pendingVoucherId.set(v._id);
      this.cart.openAuthModal('login');
      return;
    }
    this.saveToWallet(v._id);
  }

  private saveToWallet(voucherId: string): void {
    this.saveMessage.set('');
    this.voucher.saveVoucher(voucherId).subscribe({
      next: response => {
        this.saveMessage.set(`Đã lưu mã ${response.data.voucher.code} vào ví voucher của bạn!`);
      },
      error: err => {
        if (err.status === 401) {
          this.pendingVoucherId.set(voucherId);
          this.cart.openAuthModal('login');
          return;
        }
        if (err.status === 400 && err.error?.message?.includes('đã lưu')) {
          this.voucher.loadUserVouchers();
          this.saveMessage.set('Voucher này đã có trong ví của bạn.');
          return;
        }
        this.saveMessage.set(err.error?.message || 'Không thể lưu voucher lúc này.');
      },
    });
  }
}
