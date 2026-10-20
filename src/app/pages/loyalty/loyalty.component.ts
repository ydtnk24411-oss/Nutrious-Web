import { Component, signal, inject, computed } from '@angular/core';
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
export class LoyaltyComponent {
  protected loyalty = inject(LoyaltyService);
  protected cart = inject(CartService);

  readonly userPoints = computed(() => {
    const user = this.cart.currentUser();
    return user ? this.loyalty.getUserBalance(user.email) : 0;
  });

  readonly userTier = computed(() => {
    const user = this.cart.currentUser();
    if (!user) return this.loyalty.tierConfigs[0];
    return this.loyalty.getUserTier(
      this.userPoints(),
      user.totalSpent || 0
    );
  });

  readonly userTransactions = computed(() => {
    const user = this.cart.currentUser();
    return user ? this.loyalty.getUserTransactions(user.email) : [];
  });

  readonly availableRewards = computed(() => {
    return this.loyalty.getAvailableRewards();
  });

  readonly tierConfigs = this.loyalty.tierConfigs;

  redeemReward(rewardId: string): void {
    const user = this.cart.currentUser();
    if (!user) return;

    const result = this.loyalty.redeemReward(user.email, rewardId);
    if (result.success) {
      alert('Đổi quà thành công!');
    } else {
      alert(result.message || 'Không thể đổi quà');
    }
  }

  formatPrice(value: number): string {
    return value.toLocaleString('vi-VN') + 'đ';
  }
}
