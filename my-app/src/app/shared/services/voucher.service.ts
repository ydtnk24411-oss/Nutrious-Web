import { Injectable, signal, computed, effect, inject, untracked } from '@angular/core';
import { Observable, of } from 'rxjs';
import { map, tap, catchError } from 'rxjs/operators';
import { Voucher, UserVoucher } from '../models/xanh-la.models';
import { ApiService } from './api.service';
import { CartService } from './cart.service';

interface ApiVoucher {
  _id: string;
  code: string;
  name: string;
  description?: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minOrderValue?: number;
  maxDiscountValue?: number | null;
  pointsRequired?: number;
  startDate: string;
  endDate: string;
  usageLimit?: number;
  usedCount: number;
  applicableCategories?: string[];
}

interface ApiUserVoucher {
  _id: string;
  voucher: ApiVoucher;
  status: 'available' | 'used' | 'expired';
  usedAt?: string;
  orderId?: string;
}

function toVoucher(v: ApiVoucher): Voucher {
  return {
    id: v._id,
    code: v.code,
    name: v.name,
    type: v.discountType,
    value: v.discountValue,
    minValue: v.minOrderValue || undefined,
    maxValue: v.maxDiscountValue || undefined,
    categorySlugs: v.applicableCategories?.length ? v.applicableCategories : undefined,
    startDate: v.startDate,
    endDate: new Date(v.endDate).toLocaleDateString('vi-VN'),
    usageLimit: v.usageLimit || undefined,
    usedCount: v.usedCount || 0,
    description: v.description ?? '',
    isPublic: true,
  };
}

@Injectable({ providedIn: 'root' })
export class VoucherService {
  private api  = inject(ApiService);
  private cart = inject(CartService);

  private _publicVouchers = signal<Voucher[]>([]);
  private _userVouchers   = signal<UserVoucher[]>([]);

  readonly publicVouchers = this._publicVouchers.asReadonly();
  readonly userVouchers   = this._userVouchers.asReadonly();
  readonly isLoading      = signal<boolean>(false);

  /** Danh sách các mã đã sao chép (hiển thị cố định không bị ẩn khi sao chép mã khác). */
  readonly copiedCodes = signal<Set<string>>(new Set());

  readonly availableVouchers = computed(() =>
    this._userVouchers().filter(v => v.status === 'available')
  );
  readonly usedVouchers = computed(() =>
    this._userVouchers().filter(v => v.status === 'used')
  );
  readonly expiredVouchers = computed(() =>
    this._userVouchers().filter(v => v.status === 'expired')
  );

  constructor() {
    this.loadPublic();

    const userId = computed(() => this.cart.currentUser()?._id ?? null);
    effect(() => {
      const id = userId();
      untracked(() => (id ? this.refreshMine() : this._userVouchers.set([])));
    });
  }

  loadPublic(): void {
    this.isLoading.set(true);
    this.api.get<{ success: boolean; data: ApiVoucher[] }>('/vouchers').subscribe({
      next: (res) => {
        this.isLoading.set(false);
        if (res.success && Array.isArray(res.data)) {
          this._publicVouchers.set(res.data.map(toVoucher));
        } else {
          this._publicVouchers.set([]);
        }
      },
      error: () => {
        this.isLoading.set(false);
      },
    });
  }

  /** Tải voucher của tài khoản hiện tại từ database. */
  refreshMine(): void {
    if (!this.cart.currentUser()) {
      this._userVouchers.set([]);
      return;
    }
    this.api.get<{ success: boolean; data: ApiUserVoucher[] }>('/vouchers/my').subscribe({
      next: (res) => {
        if (!res.success || !Array.isArray(res.data)) return;
        this._userVouchers.set(res.data.filter(uv => uv && uv.voucher).map(uv => ({
          voucherId: uv.voucher._id,
          voucher: toVoucher(uv.voucher),
          status: uv.status,
          usedAt: uv.usedAt,
          orderId: uv.orderId,
        })));
      },
      error: () => {
        // Lỗi 401 do interceptor xử lý
      },
    });
  }

  /** Sao chép mã vào clipboard và giữ hiển thị mã trên giao diện. */
  copyCode(code: string): void {
    const clean = code.trim().toUpperCase();
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(clean).catch(() => this.fallbackCopy(clean));
    } else {
      this.fallbackCopy(clean);
    }
    this.copiedCodes.update(prev => {
      const next = new Set(prev);
      next.add(clean);
      return next;
    });
  }

  isCopied(code: string): boolean {
    return this.copiedCodes().has(code.trim().toUpperCase());
  }

  private fallbackCopy(code: string): void {
    if (typeof document === 'undefined') return;
    const input = document.createElement('textarea');
    input.value = code;
    input.style.position = 'fixed';
    input.style.opacity = '0';
    document.body.appendChild(input);
    input.select();
    document.execCommand('copy');
    input.remove();
  }

  isSaved(voucherIdOrCode: string): boolean {
    const key = voucherIdOrCode.trim().toUpperCase();
    return this._userVouchers().some(
      uv => uv.voucherId === voucherIdOrCode || (uv.voucher?.code && uv.voucher.code.toUpperCase() === key)
    );
  }

  getUserVoucher(voucherIdOrCode: string): UserVoucher | undefined {
    const key = voucherIdOrCode.trim().toUpperCase();
    return this._userVouchers().find(
      uv => uv.voucherId === voucherIdOrCode || (uv.voucher?.code && uv.voucher.code.toUpperCase() === key)
    );
  }

  // Server kiểm tra voucher + tính số tiền giảm
  validateVoucher(
    voucherCode: string,
    cartTotal: number
  ): Observable<{ valid: boolean; message?: string; discount: number }> {
    return this.api.post<{ success: boolean; valid: boolean; message?: string; discount: number }>(
      '/vouchers/validate', { code: voucherCode, subtotal: cartTotal }
    ).pipe(
      map((res) => ({ valid: !!res.valid, message: res.message, discount: res.discount || 0 })),
      catchError((err) => of({
        valid: false,
        message: (err?.error?.message as string | undefined) ?? 'Không kiểm tra được voucher, vui lòng thử lại.',
        discount: 0,
      }))
    );
  }

  // Thu thập voucher cho tài khoản đang đăng nhập (có thể trừ điểm)
  collectVoucher(voucherId: string): Observable<{ success: boolean; message?: string }> {
    if (!this.cart.currentUser()) {
      this.cart.openAuthModal('login');
      return of({ success: false, message: 'Vui lòng đăng nhập để thu thập voucher.' });
    }
    return this.api.post<{ success: boolean; message?: string }>(
      `/vouchers/${voucherId}/claim`, {}
    ).pipe(
      tap((res) => {
        if (res.success) {
          this.refreshMine();
          this.cart.loadUserData();
        }
      }),
      catchError((err) => of({ success: false, message: err?.error?.message as string | undefined }))
    );
  }

  getPublicVouchers(): Voucher[] {
    return this._publicVouchers();
  }
}
