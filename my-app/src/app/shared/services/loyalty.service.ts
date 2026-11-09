import { Injectable, signal, computed, effect, inject, untracked } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { LoyaltyTier, LoyaltyTierConfig, PointTransaction, LoyaltyReward } from '../models/xanh-la.models';
import { ApiService } from './api.service';
import { CartService } from './cart.service';

@Injectable({ providedIn: 'root' })
export class LoyaltyService {
  private api  = inject(ApiService);
  private cart = inject(CartService);

  private _balance          = signal(0);
  private _totalSpent       = signal(0);
  private _transactions     = signal<PointTransaction[]>([]);
  private _rewards          = signal<LoyaltyReward[]>([]);

  readonly balance          = this._balance.asReadonly();
  readonly totalSpent       = this._totalSpent.asReadonly();
  readonly transactions     = this._transactions.asReadonly();
  readonly rewards          = this._rewards.asReadonly();
  readonly isLoading        = signal(false);
  readonly isLoadingRewards = signal(false);

  // Loyalty tier configuration
  readonly tierConfigs: LoyaltyTierConfig[] = [
    {
      tier: 'Bronze',
      name: 'Đồng',
      minPoints: 0,
      minSpent: 0,
      benefits: ['Tích 1 điểm cho mỗi 10.000đ', 'Miễn phí giao hàng đơn > 500.000đ'],
      icon: '🥉',
    },
    {
      tier: 'Silver',
      name: 'Bạc',
      minPoints: 1000,
      minSpent: 2000000,
      benefits: ['Tích 1.2 điểm cho mỗi 10.000đ', 'Miễn phí giao hàng đơn > 300.000đ', 'Ưu tiên hỗ trợ'],
      icon: '🥈',
    },
    {
      tier: 'Gold',
      name: 'Vàng',
      minPoints: 5000,
      minSpent: 10000000,
      benefits: ['Tích 1.5 điểm cho mỗi 10.000đ', 'Miễn phí giao hàng mọi đơn hàng', 'Quà tặng sinh nhật', 'Ưu đãi thành viên Vàng độc quyền'],
      icon: '🥇',
    },
    {
      tier: 'Platinum',
      name: 'Bạch kim',
      minPoints: 15000,
      minSpent: 30000000,
      benefits: ['Tích 2 điểm cho mỗi 10.000đ', 'Miễn phí giao hàng mọi đơn hàng', 'Quà tặng sinh nhật đặc biệt', 'Dịch vụ VIP', 'Quản lý tài khoản cá nhân'],
      icon: '💎',
    },
  ];

  constructor() {
    this.loadRewards();

    // Theo dõi theo _id tài khoản: đăng nhập/đổi tài khoản → tải lại, đăng xuất → xóa sạch
    const userId = computed(() => this.cart.currentUser()?._id ?? null);
    effect(() => {
      const id = userId();
      untracked(() => (id ? this.refresh() : this._clear()));
    });
  }

  loadRewards(): void {
    this.isLoadingRewards.set(true);
    this.api.get<{ success: boolean; data: LoyaltyReward[] }>('/loyalty/rewards').subscribe({
      next: (res) => {
        this.isLoadingRewards.set(false);
        if (res.success && Array.isArray(res.data)) {
          this._rewards.set(res.data);
        } else {
          this._rewards.set([]);
        }
      },
      error: () => {
        this.isLoadingRewards.set(false);
        this._rewards.set([]);
      }
    });
  }

  /** Tải điểm + lịch sử của tài khoản hiện tại từ server. */
  refresh(): void {
    if (!this.cart.currentUser()) { this._clear(); return; }
    this.isLoading.set(true);
    this.api.get<{ success: boolean; data: { points: number; totalSpent: number; transactions: PointTransaction[] } }>(
      '/loyalty/my'
    ).subscribe({
      next: (res) => {
        this.isLoading.set(false);
        if (!res.success || !res.data) return;
        this._balance.set(res.data.points || 0);
        this._totalSpent.set(res.data.totalSpent || 0);
        this._transactions.set(Array.isArray(res.data.transactions) ? res.data.transactions : []);
      },
      error: () => {
        this.isLoading.set(false);
      },
    });
  }

  // Get user's current tier based on points and spent
  getUserTier(points: number, spent: number): LoyaltyTierConfig {
    for (let i = this.tierConfigs.length - 1; i >= 0; i--) {
      const tier = this.tierConfigs[i];
      if (points >= tier.minPoints && spent >= tier.minSpent) {
        return tier;
      }
    }
    return this.tierConfigs[0]; // Default to Bronze
  }

  // Calculate points earned from order
  calculatePointsEarned(orderTotal: number, userTier: LoyaltyTier): number {
    const tier = this.tierConfigs.find(t => t.tier === userTier) || this.tierConfigs[0];
    const pointsPer10k = tier.tier === 'Bronze' ? 1 : tier.tier === 'Silver' ? 1.2 : tier.tier === 'Gold' ? 1.5 : 2;
    return Math.floor((orderTotal / 10000) * pointsPer10k);
  }

  getUserBalance(_userId?: string): number {
    return this._balance();
  }

  getUserTransactions(_userId?: string): PointTransaction[] {
    return this._transactions();
  }

  // Đổi quà: server kiểm tra đủ điểm và trừ điểm
  redeemReward(_userId: string, rewardId: string): Observable<{ success: boolean; message?: string }> {
    return this.api.post<{ success: boolean; message?: string; data?: { points: number } }>(
      '/loyalty/redeem', { rewardId }
    ).pipe(
      tap((res) => {
        if (res.success) {
          this.refresh();
          this.cart.loadUserData();
        }
      }),
      map((res) => ({ success: res.success, message: res.message })),
      catchError((err) => of({ success: false, message: err?.error?.message as string | undefined }))
    );
  }

  getAvailableRewards(): LoyaltyReward[] {
    return this._rewards().filter(r => r.available && (r.stock === undefined || r.stock > 0));
  }

  private _clear(): void {
    this._balance.set(0);
    this._totalSpent.set(0);
    this._transactions.set([]);
  }
}
