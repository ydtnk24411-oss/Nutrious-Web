import { Injectable, signal, computed } from '@angular/core';
import { LoyaltyTier, LoyaltyTierConfig, PointTransaction, LoyaltyReward, Redemption } from '../models/xanh-la.models';

const TRANSACTIONS_KEY = 'xanhla_point_transactions';
const REDEMPTIONS_KEY = 'xanhla_redemptions';

@Injectable({ providedIn: 'root' })
export class LoyaltyService {
  private _transactions = signal<PointTransaction[]>(this._loadTransactions());
  private _redemptions = signal<Redemption[]>(this._loadRedemptions());

  readonly transactions = this._transactions.asReadonly();
  readonly redemptions = this._redemptions.asReadonly();

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

  // Sample rewards
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
    // Initialize with sample data if empty
    if (this._transactions().length === 0) {
      this._initializeSampleData();
    }
  }

  // Get user's current tier based on points and spent
  getUserTier(points: number, spent: number): LoyaltyTierConfig {
    // Find highest tier user qualifies for
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

  // Add points (when order is completed)
  addPoints(userId: string, amount: number, description: string, orderId?: string): void {
    const transaction: PointTransaction = {
      id: Date.now().toString(),
      userId,
      type: 'earned',
      amount,
      description,
      orderId,
      createdAt: new Date().toISOString(),
    };
    this._transactions.update(t => [transaction, ...t]);
    this._saveTransactions();
  }

  // Deduct points (when redeeming reward)
  deductPoints(userId: string, amount: number, description: string, rewardId?: string): void {
    const transaction: PointTransaction = {
      id: Date.now().toString(),
      userId,
      type: 'redeemed',
      amount: -amount,
      description,
      rewardId,
      createdAt: new Date().toISOString(),
    };
    this._transactions.update(t => [transaction, ...t]);
    this._saveTransactions();
  }

  // Adjust points (admin action or correction)
  adjustPoints(userId: string, amount: number, description: string): void {
    const transaction: PointTransaction = {
      id: Date.now().toString(),
      userId,
      type: 'adjusted',
      amount,
      description,
      createdAt: new Date().toISOString(),
    };
    this._transactions.update(t => [transaction, ...t]);
    this._saveTransactions();
  }

  // Get user's point balance
  getUserBalance(userId: string): number {
    return this._transactions()
      .filter(t => t.userId === userId)
      .reduce((sum, t) => sum + t.amount, 0);
  }

  // Get user's transaction history
  getUserTransactions(userId: string): PointTransaction[] {
    return this._transactions()
      .filter(t => t.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // Redeem reward
  redeemReward(userId: string, rewardId: string): { success: boolean; message?: string } {
    const reward = this.rewards.find(r => r.id === rewardId);
    if (!reward) {
      return { success: false, message: 'Quà tặng không tồn tại' };
    }

    if (!reward.available) {
      return { success: false, message: 'Quà tặng đã hết' };
    }

    if (reward.stock !== undefined && reward.stock <= 0) {
      return { success: false, message: 'Quà tặng đã hết hàng' };
    }

    const balance = this.getUserBalance(userId);
    if (balance < reward.pointsRequired) {
      return { success: false, message: 'Điểm không đủ' };
    }

    // Deduct points
    this.deductPoints(userId, reward.pointsRequired, `Đổi quà: ${reward.name}`, rewardId);

    // Create redemption record
    const redemption: Redemption = {
      id: Date.now().toString(),
      userId,
      rewardId,
      reward,
      pointsUsed: reward.pointsRequired,
      status: 'approved',
      createdAt: new Date().toISOString(),
      approvedAt: new Date().toISOString(),
    };
    this._redemptions.update(r => [redemption, ...r]);
    this._saveRedemptions();

    return { success: true };
  }

  // Get user's redemption history
  getUserRedemptions(userId: string): Redemption[] {
    return this._redemptions()
      .filter(r => r.userId === userId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  // Get available rewards
  getAvailableRewards(): LoyaltyReward[] {
    return this.rewards.filter(r => r.available && (r.stock === undefined || r.stock > 0));
  }

  private _loadTransactions(): PointTransaction[] {
    try {
      const data = localStorage.getItem(TRANSACTIONS_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  private _saveTransactions(): void {
    try {
      localStorage.setItem(TRANSACTIONS_KEY, JSON.stringify(this._transactions()));
    } catch {
      // Ignore storage errors
    }
  }

  private _loadRedemptions(): Redemption[] {
    try {
      const data = localStorage.getItem(REDEMPTIONS_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  private _saveRedemptions(): void {
    try {
      localStorage.setItem(REDEMPTIONS_KEY, JSON.stringify(this._redemptions()));
    } catch {
      // Ignore storage errors
    }
  }

  private _initializeSampleData(): void {
    // Sample transactions for demo user
    const sampleTransactions: PointTransaction[] = [
      {
        id: 't1',
        userId: 'demo_user',
        type: 'earned',
        amount: 150,
        description: 'Đơn hàng XL-470634',
        orderId: 'XL-470634',
        createdAt: '2025-10-10T10:00:00Z',
      },
      {
        id: 't2',
        userId: 'demo_user',
        type: 'earned',
        amount: 85,
        description: 'Đơn hàng XL-470635',
        orderId: 'XL-470635',
        createdAt: '2025-10-08T15:30:00Z',
      },
    ];
    this._transactions.set(sampleTransactions);
    this._saveTransactions();
  }
}
