import { Injectable, signal, computed } from '@angular/core';
import { Voucher, UserVoucher, VoucherType } from '../models/xanh-la.models';

const USER_VOUCHERS_KEY = 'xanhla_user_vouchers';

@Injectable({ providedIn: 'root' })
export class VoucherService {
  private _userVouchers = signal<UserVoucher[]>(this._loadUserVouchers());

  readonly userVouchers = this._userVouchers.asReadonly();

  readonly availableVouchers = computed(() =>
    this._userVouchers().filter(v => v.status === 'available')
  );

  readonly usedVouchers = computed(() =>
    this._userVouchers().filter(v => v.status === 'used')
  );

  readonly expiredVouchers = computed(() =>
    this._userVouchers().filter(v => v.status === 'expired')
  );

  // Sample vouchers
  private sampleVouchers: Voucher[] = [
    {
      id: 'v1',
      code: 'GIAM10',
      name: 'Giảm 10% cho đơn hàng',
      type: 'percentage',
      value: 10,
      minValue: 300000,
      maxValue: 50000,
      startDate: '2025-01-01',
      endDate: '2025-12-31',
      usageLimit: 1000,
      usedCount: 234,
      description: 'Giảm 10% tối đa 50.000đ cho đơn hàng từ 300.000đ',
      isPublic: true,
    },
    {
      id: 'v2',
      code: 'GIAM30K',
      name: 'Giảm 30.000đ',
      type: 'fixed',
      value: 30000,
      minValue: 200000,
      startDate: '2025-01-01',
      endDate: '2025-12-31',
      usageLimit: 500,
      usedCount: 89,
      description: 'Giảm trực tiếp 30.000đ cho đơn hàng từ 200.000đ',
      isPublic: true,
    },
    {
      id: 'v3',
      code: 'FREESHIP',
      name: 'Miễn phí giao hàng',
      type: 'freeship',
      value: 25000,
      minValue: 150000,
      startDate: '2025-01-01',
      endDate: '2025-12-31',
      usageLimit: 2000,
      usedCount: 567,
      description: 'Miễn phí giao hàng cho đơn hàng từ 150.000đ',
      isPublic: true,
    },
    {
      id: 'v4',
      code: 'RAU5',
      name: 'Giảm 5% cho Rau củ',
      type: 'category',
      value: 5,
      minValue: 100000,
      categorySlugs: ['/category/vegetables'],
      startDate: '2025-01-01',
      endDate: '2025-12-31',
      usageLimit: 1000,
      usedCount: 123,
      description: 'Giảm 5% cho sản phẩm rau củ từ 100.000đ',
      isPublic: true,
    },
  ];

  constructor() {
    // Initialize with sample data if empty
    if (this._userVouchers().length === 0) {
      this._initializeSampleVouchers();
    }
  }

  // Check if voucher is valid for a cart
  validateVoucher(
    voucherCode: string,
    cartTotal: number,
    cartCategories?: string[]
  ): { valid: boolean; message?: string; discount: number } {
    const voucher = this.sampleVouchers.find(v => v.code === voucherCode);
    if (!voucher) {
      return { valid: false, message: 'Mã voucher không tồn tại', discount: 0 };
    }

    const now = new Date();
    const start = new Date(voucher.startDate);
    const end = new Date(voucher.endDate);

    if (now < start || now > end) {
      return { valid: false, message: 'Voucher đã hết hạn', discount: 0 };
    }

    if (voucher.usageLimit && voucher.usedCount >= voucher.usageLimit) {
      return { valid: false, message: 'Voucher đã hết lượt sử dụng', discount: 0 };
    }

    if (voucher.minValue && cartTotal < voucher.minValue) {
      return {
        valid: false,
        message: `Đơn hàng tối thiểu ${this.formatPrice(voucher.minValue)}`,
        discount: 0,
      };
    }

    // Check category restriction
    if (voucher.type === 'category' && voucher.categorySlugs && cartCategories) {
      const hasMatchingCategory = cartCategories.some(cat =>
        voucher.categorySlugs!.some(slug => cat.includes(slug))
      );
      if (!hasMatchingCategory) {
        return { valid: false, message: 'Voucher chỉ áp dụng cho danh mục sản phẩm cụ thể', discount: 0 };
      }
    }

    // Calculate discount
    let discount = 0;
    switch (voucher.type) {
      case 'percentage':
        discount = (cartTotal * voucher.value) / 100;
        if (voucher.maxValue) {
          discount = Math.min(discount, voucher.maxValue);
        }
        break;
      case 'fixed':
        discount = voucher.value;
        break;
      case 'freeship':
        discount = Math.min(voucher.value, 25000); // Assume max shipping fee
        break;
      case 'category':
        discount = (cartTotal * voucher.value) / 100;
        break;
    }

    return { valid: true, discount };
  }

  // Apply voucher to cart
  applyVoucher(voucherCode: string, cartTotal: number, cartCategories?: string[]): number {
    const result = this.validateVoucher(voucherCode, cartTotal, cartCategories);
    return result.valid ? result.discount : 0;
  }

  // Collect/Save voucher for user
  collectVoucher(voucherId: string): boolean {
    const voucher = this.sampleVouchers.find(v => v.id === voucherId);
    if (!voucher) return false;

    // Check if already collected
    if (this._userVouchers().some(v => v.voucherId === voucherId && v.status === 'available')) {
      return false;
    }

    const userVoucher: UserVoucher = {
      voucherId,
      voucher,
      status: 'available',
    };

    this._userVouchers.update(v => [...v, userVoucher]);
    this._saveUserVouchers();
    return true;
  }

  // Mark voucher as used
  useVoucher(voucherId: string, orderId: string): void {
    this._userVouchers.update(v =>
      v.map(uv =>
        uv.voucherId === voucherId && uv.status === 'available'
          ? { ...uv, status: 'used', usedAt: new Date().toISOString(), orderId }
          : uv
      )
    );
    this._saveUserVouchers();
  }

  // Get voucher by code
  getVoucherByCode(code: string): Voucher | undefined {
    return this.sampleVouchers.find(v => v.code === code);
  }

  // Get all public vouchers
  getPublicVouchers(): Voucher[] {
    return this.sampleVouchers.filter(v => v.isPublic);
  }

  private _loadUserVouchers(): UserVoucher[] {
    try {
      const data = localStorage.getItem(USER_VOUCHERS_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  private _saveUserVouchers(): void {
    try {
      localStorage.setItem(USER_VOUCHERS_KEY, JSON.stringify(this._userVouchers()));
    } catch {
      // Ignore storage errors
    }
  }

  private _initializeSampleVouchers(): void {
    // Give user all sample vouchers as available
    const userVouchers: UserVoucher[] = this.sampleVouchers.map(v => ({
      voucherId: v.id,
      voucher: v,
      status: 'available' as const,
    }));
    this._userVouchers.set(userVouchers);
    this._saveUserVouchers();
  }

  private formatPrice(value: number): string {
    return value.toLocaleString('vi-VN') + 'đ';
  }
}
