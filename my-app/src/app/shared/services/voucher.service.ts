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
  voucherType?: 'ORDER_DISCOUNT' | 'SHIPPING_DISCOUNT';
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minOrderValue?: number;
  maxDiscountValue?: number | null;
  pointsRequired?: number;
  startDate: string;
  endDate: string;
  usageLimit?: number;
  usedCount: number;
  maxUsagePerUser?: number;
  isFirstOrderOnly?: boolean;
  isPublic?: boolean;
  activeTimeWindow?: { start: string; end: string } | null;
  activeDaysOfWeek?: number[];
  applicableCategories?: string[];
  applicableProductIds?: string[];
  excludeSaleItems?: boolean;
  requiredPaymentMethod?: string | null;
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
    voucherType: v.voucherType,
    value: v.discountValue,
    minValue: v.minOrderValue || undefined,
    maxValue: v.maxDiscountValue || undefined,
    categorySlugs: v.applicableCategories?.length ? v.applicableCategories : undefined,
    applicableCategories: v.applicableCategories,
    applicableProductIds: v.applicableProductIds,
    excludeSaleItems: Boolean(v.excludeSaleItems),
    requiredPaymentMethod: v.requiredPaymentMethod || null,
    activeTimeWindow: v.activeTimeWindow || null,
    activeDaysOfWeek: v.activeDaysOfWeek,
    startDate: v.startDate,
    endDate: new Date(v.endDate).toLocaleDateString('vi-VN'),
    usageLimit: v.usageLimit || undefined,
    usedCount: v.usedCount || 0,
    maxUsagePerUser: v.maxUsagePerUser || 0,
    isFirstOrderOnly: Boolean(v.isFirstOrderOnly),
    pointsRequired: v.pointsRequired || 0,
    description: v.description ?? '',
    isPublic: v.isPublic !== false,
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

  /** Kiểm tra hiệu lực theo khung giờ vàng / chu kỳ thời gian trên client để hiển thị nhãn trạng thái */
  checkTimeWindow(v: Voucher): { valid: boolean; statusLabel?: string } {
    if (!v) return { valid: true };
    const now = new Date();
    const currentDay = now.getDay(); // 0: CN, 1: T2, ..., 6: T7
    if (Array.isArray(v.activeDaysOfWeek) && v.activeDaysOfWeek.length > 0) {
      if (!v.activeDaysOfWeek.includes(currentDay)) {
        return { valid: false, statusLabel: 'Không áp dụng hôm nay' };
      }
    }
    if (v.activeTimeWindow?.start && v.activeTimeWindow?.end) {
      const currentMins = now.getHours() * 60 + now.getMinutes();
      const [sh, sm] = v.activeTimeWindow.start.split(':').map(Number);
      const [eh, em] = v.activeTimeWindow.end.split(':').map(Number);
      const startMins = sh * 60 + (sm || 0);
      const endMins = eh * 60 + (em || 0);
      if (currentMins < startMins) {
        return { valid: false, statusLabel: `Sắp diễn ra lúc ${v.activeTimeWindow.start}` };
      }
      if (currentMins > endMins) {
        return { valid: false, statusLabel: `Đã kết thúc lúc ${v.activeTimeWindow.end}` };
      }
    }
    return { valid: true };
  }

  // Server kiểm tra voucher + tính số tiền giảm
  validateVoucher(
    voucherCode: string,
    cartTotalOrOptions: number | {
      subtotal: number;
      items?: any[];
      phone?: string;
      email?: string;
      paymentMethod?: string;
      expectedVoucherType?: 'ORDER_DISCOUNT' | 'SHIPPING_DISCOUNT';
    },
    phone?: string,
    email?: string
  ): Observable<{
    valid: boolean;
    message?: string;
    discount: number;
    eligibleSubtotal?: number;
    voucherType?: string;
    reason?: string;
    timeWindow?: { start: string; end: string };
  }> {
    let payload: any = { code: voucherCode };
    if (typeof cartTotalOrOptions === 'object' && cartTotalOrOptions !== null) {
      payload = {
        code: voucherCode,
        subtotal: cartTotalOrOptions.subtotal,
        items: cartTotalOrOptions.items || [],
        phone: cartTotalOrOptions.phone,
        email: cartTotalOrOptions.email,
        paymentMethod: cartTotalOrOptions.paymentMethod,
        expectedVoucherType: cartTotalOrOptions.expectedVoucherType,
      };
    } else {
      payload = {
        code: voucherCode,
        subtotal: cartTotalOrOptions,
        phone,
        email,
      };
    }

    return this.api.post<{
      success: boolean;
      valid: boolean;
      message?: string;
      discount: number;
      eligibleSubtotal?: number;
      voucherType?: string;
      reason?: string;
      timeWindow?: { start: string; end: string };
    }>(
      '/vouchers/validate', payload
    ).pipe(
      map((res) => ({
        valid: !!res.valid,
        message: res.message,
        discount: res.discount || 0,
        eligibleSubtotal: res.eligibleSubtotal,
        voucherType: res.voucherType,
        reason: res.reason,
        timeWindow: res.timeWindow,
      })),
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

  /** Tìm voucher theo mã code (hoặc _id) từ API, có fallback sang cache công khai/ví cá nhân */
  getVoucherDetail(codeOrId: string): Observable<Voucher | null> {
    const clean = (codeOrId || '').trim();
    if (!clean) return of(null);

    const findCached = (): Voucher | null => {
      const upper = clean.toUpperCase();
      const fromPub = this._publicVouchers().find(
        (v) => v.code.toUpperCase() === upper || v.id === clean
      );
      if (fromPub) return fromPub;
      const fromMine = this._userVouchers().find(
        (uv) => uv.voucher?.code?.toUpperCase() === upper || uv.voucherId === clean
      );
      return fromMine?.voucher ?? null;
    };

    return this.api
      .get<{ success: boolean; data: ApiVoucher }>(`/vouchers/detail/${encodeURIComponent(clean)}`)
      .pipe(
        map((res) => (res?.success && res.data ? toVoucher(res.data) : findCached())),
        catchError(() => of(findCached()))
      );
  }
}
