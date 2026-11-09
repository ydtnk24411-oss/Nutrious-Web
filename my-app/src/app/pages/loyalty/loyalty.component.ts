import { Component, signal, inject, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ShellComponent } from '../../components/shell/shell.component';
import { LoyaltyService } from '../../shared/services/loyalty.service';
import { CartService } from '../../shared/services/cart.service';

@Component({
  selector: 'app-loyalty',
  standalone: true,
  imports: [CommonModule, ShellComponent],
  templateUrl: './loyalty.component.html',
  styleUrl: './loyalty.component.css',
})
export class LoyaltyComponent implements OnInit {
  protected loyalty = inject(LoyaltyService);
  protected cart = inject(CartService);

  redeemMessage = signal<string>('');
  redeemError = signal<string>('');
  redeemingId = signal<string | null>(null);

  readonly userPoints = computed(() => {
    const user = this.cart.currentUser();
    return user ? this.loyalty.balance() : 0;
  });

  readonly userTier = computed(() => {
    const user = this.cart.currentUser();
    if (!user) return this.loyalty.tierConfigs[0];
    return this.loyalty.getUserTier(
      this.userPoints(),
      this.loyalty.totalSpent() || user.totalSpent || 0
    );
  });

  readonly userTransactions = computed(() => {
    return this.loyalty.transactions();
  });

  readonly availableRewards = computed(() => {
    return this.loyalty.getAvailableRewards();
  });

  readonly isLoading = this.loyalty.isLoading;
  readonly isLoadingRewards = this.loyalty.isLoadingRewards;
  readonly tierConfigs = this.loyalty.tierConfigs;

  ngOnInit(): void {
    if (this.cart.currentUser()) {
      this.loyalty.refresh();
      this.loyalty.loadRewards();
    }
  }

  redeemReward(rewardId: string): void {
    const user = this.cart.currentUser();
    if (!user) {
      this.cart.openAuthModal('login');
      return;
    }

    this.redeemingId.set(rewardId);
    this.redeemMessage.set('');
    this.redeemError.set('');

    this.loyalty.redeemReward(user.email, rewardId).subscribe((result) => {
      this.redeemingId.set(null);
      if (result.success) {
        this.redeemMessage.set(result.message || 'Đổi quà thành công! Phần thưởng đã được thêm vào tài khoản của bạn.');
        setTimeout(() => this.redeemMessage.set(''), 5000);
      } else {
        this.redeemError.set(result.message || 'Không thể đổi quà. Vui lòng kiểm tra lại số điểm của bạn.');
        setTimeout(() => this.redeemError.set(''), 5000);
      }
    });
  }

  formatPrice(value: number): string {
    return (value || 0).toLocaleString('vi-VN') + 'đ';
  }
}
