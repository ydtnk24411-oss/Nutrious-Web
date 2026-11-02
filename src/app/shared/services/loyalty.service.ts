import { Injectable, signal, computed, effect, inject, untracked } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { LoyaltyTier, LoyaltyTierConfig, PointTransaction, LoyaltyReward } from '../models/xanh-la.models';
import { ApiService } from './api.service';
import { CartService } from './cart.service';

/**
 * Điểm thưởng & lịch sử điểm lấy từ server theo TÀI KHOẢN đang đăng nhập
 * (không còn lưu ở localStorage). Đổi tài khoản → dữ liệu tự tải lại / xóa sạch.
 */
@Injectable({ providedIn: 'root' })
export class LoyaltyService {
  private api  = inject(ApiService);
  private cart = inject(CartService);

  private _balance      = signal(0);
  private _totalSpent   = signal(0);
  private _transactions = signal<PointTransaction[]>([]);

  readonly balance      = this._balance.asReadonly();
  readonly totalSpent   = this._totalSpent.asReadonly();
  readonly transactions = this._transactions.asReadonly();

  // Loyalty tier configuration (SAMPLE POLICY - ghi rõ là chính sách giả lập)
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
      benefits: ['Tích 1.5 điểm cho mỗi 10.000đ', 'Miễn phí giao hàng mọi đơn hàng', 'Quà tặng sinh nhật', 'Được mời sự kiện độc quyền'],
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

  // Danh sách quà hiển thị (số điểm thực tế do server quyết định khi đổi)
  readonly rewards: LoyaltyReward[] = [
    {
      id: 'r1',
      name: 'Voucher 50.000đ',
      description: 'Giảm 50.000đ cho đơn hàng từ 200.000đ',
      image: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=200',
      pointsRequired: 500,
      type: 'voucher',
      value: 50000,
      voucherId: 'v50k',
      available: true,
      stock: 100,
    },
    {
      id: 'r2',
      name: 'Miễn phí giao hàng',
      description: 'Miễn phí giao hàng cho đơn hàng bất kỳ',
      image: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=200',
      pointsRequired: 300,
      type: 'shipping',
      value: 25000,
      available: true,
      stock: 500,
    },
    {
      id: 'r3',
      name: 'Voucher 100.000đ',
      description: 'Giảm 100.000đ cho đơn hàng từ 400.000đ',
      image: 'https://images.unsplash.com/photo-1556742049-0cfed4f6a45d?w=200',
      pointsRequired: 1000,
      type: 'voucher',
      value: 100000,
      voucherId: 'v100k',
      available: true,
      stock: 50,
    },
    {
      id: 'r4',
      name: 'Giỏ quà sinh nhật',
      description: 'Giỏ quà đặc biệt gồm các sản phẩm Xanh Lá',
      image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=200',
      pointsRequired: 2000,
      type: 'gift',
      available: true,
      stock: 20,
    },
  ];

  constructor() {
    // Theo dõi theo _id tài khoản: đăng nhập/đổi tài khoản → tải lại, đăng xuất → xóa sạch
    const userId = computed(() => this.cart.currentUser()?._id ?? null);
    effect(() => {
      const id = userId();
      untracked(() => (id ? this.refresh() : this._clear()));
    });
  }

  /** Tải điểm + lịch sử của tài khoản hiện tại từ server. */
  refresh(): void {
    if (!this.cart.currentUser()) { this._clear(); return; }
    this.api.get<{ success: boolean; data: { points: number; totalSpent: number; transactions: PointTransaction[] } }>(
      '/loyalty/my'
    ).subscribe({
      next: (res) => {
        if (!res.success) return;
        this._balance.set(res.data.points);
        this._totalSpent.set(res.data.totalSpent);
        this._transactions.set(res.data.transactions);
      },
      error: () => { /* 401 do interceptor xử lý */ },
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

  // Calculate points earned from order (SAMPLE POLICY)
  calculatePointsEarned(orderTotal: number, userTier: LoyaltyTier): number {
    const tier = this.tierConfigs.find(t => t.tier === userTier) || this.tierConfigs[0];
    const pointsPer10k = tier.tier === 'Bronze' ? 1 : tier.tier === 'Silver' ? 1.2 : tier.tier === 'Gold' ? 1.5 : 2;
    return Math.floor((orderTotal / 10000) * pointsPer10k);
  }

  // Số dư điểm của tài khoản đang đăng nhập (tham số giữ lại cho tương thích)
  getUserBalance(_userId?: string): number {
    return this._balance();
  }

  // Lịch sử điểm của tài khoản đang đăng nhập
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

  // Get available rewards
  getAvailableRewards(): LoyaltyReward[] {
    return this.rewards.filter(r => r.available && (r.stock === undefined || r.stock > 0));
  }

  private _clear(): void {
    this._balance.set(0);
    this._totalSpent.set(0);
    this._transactions.set([]);
  }
}
