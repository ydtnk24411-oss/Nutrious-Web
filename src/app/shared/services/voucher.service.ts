import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, tap } from 'rxjs';
import { ApiService } from './api.service';

export interface VoucherRecord {
  _id: string;
  code: string;
  name: string;
  description?: string;
  discountType: 'percentage' | 'percent' | 'fixed';
  discountValue: number;
  minOrderValue: number;
  maxDiscountValue?: number;
  pointsRequired: number;
  startDate: string;
  endDate: string;
  usageLimit: number;
  usedCount: number;
  isActive: boolean;
  applicableCategories: string[];
}

export interface UserVoucherRecord {
  _id: string;
  status: 'available' | 'used' | 'expired';
  receivedAt: string;
  usedAt?: string;
  orderId?: string;
  voucher: VoucherRecord;
}

export interface CheckoutVoucherRecord {
  _id?: string;
  userVoucherId: string;
  voucherId: string;
  code: string;
  name: string;
  description?: string;
  discountType: 'percentage' | 'percent' | 'fixed';
  discountValue: number;
  minOrderValue: number;
  maxDiscountValue?: number;
  endDate: string;
  discountAmount: number;
  canApply: boolean;
  inWallet?: boolean;
  voucher?: VoucherRecord;
}

export interface VoucherValidation {
  voucherId: string;
  code: string;
  name: string;
  description?: string;
  discountType: 'percentage' | 'percent' | 'fixed';
  discountValue: number;
  discountAmount: number;
  maxDiscountValue?: number;
  minOrderValue?: number;
}

@Injectable({ providedIn: 'root' })
export class VoucherService {
  private api = inject(ApiService);

  private _publicVouchers = signal<VoucherRecord[]>([]);
  readonly publicVouchers = this._publicVouchers.asReadonly();
  readonly publicLoading = signal(false);

  private _userVouchers = signal<UserVoucherRecord[]>([]);
  readonly userVouchers = this._userVouchers.asReadonly();
  readonly userLoading = signal(false);

  // Persistent set of revealed/copied voucher codes so copying another code never hides previous ones
  private _copiedCodes = signal<Set<string>>(new Set<string>());
  readonly copiedCodes = this._copiedCodes.asReadonly();

  readonly availableVouchers = computed(() =>
    this._userVouchers().filter(voucher => voucher.status === 'available' && !!voucher.voucher)
  );

  readonly usedVouchers = computed(() =>
    this._userVouchers().filter(voucher => voucher.status === 'used' && !!voucher.voucher)
  );

  readonly expiredVouchers = computed(() =>
    this._userVouchers().filter(voucher => voucher.status === 'expired' && !!voucher.voucher)
  );

  copyCode(code: string): void {
    const normalized = (code || '').trim().toUpperCase();
    if (!normalized) return;
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(normalized).catch(() => undefined);
    }
    this._copiedCodes.update(prev => {
      const next = new Set(prev);
      next.add(normalized);
      return next;
    });
  }

  isCopied(code: string): boolean {
    const normalized = (code || '').trim().toUpperCase();
    return this._copiedCodes().has(normalized);
  }

  isSaved(voucherIdOrCode: string): boolean {
    return this._userVouchers().some(
      uv =>
        uv.voucher &&
        (uv.voucher._id === voucherIdOrCode || uv.voucher.code === voucherIdOrCode.toUpperCase())
    );
  }

  loadPublicVouchers(): void {
    this.publicLoading.set(true);
    this.api.get<{ success: boolean; data: VoucherRecord[] }>('/vouchers').subscribe({
      next: response => {
        this._publicVouchers.set(response.data ?? []);
        this.publicLoading.set(false);
      },
      error: () => {
        this._publicVouchers.set([]);
        this.publicLoading.set(false);
      },
    });
  }

  loadUserVouchers(): void {
    if (typeof localStorage === 'undefined' || !localStorage.getItem('xanhla_auth_token')) {
      this._userVouchers.set([]);
      this.userLoading.set(false);
      return;
    }
    this.userLoading.set(true);
    this.api.get<{ success: boolean; data: UserVoucherRecord[] }>('/vouchers/my').subscribe({
      next: response => {
        this._userVouchers.set((response.data ?? []).filter(item => !!item.voucher));
        this.userLoading.set(false);
      },
      error: () => {
        this._userVouchers.set([]);
        this.userLoading.set(false);
      },
    });
  }

  saveVoucher(voucherId: string): Observable<{ success: boolean; data: UserVoucherRecord; message?: string }> {
    return this.api.post<{ success: boolean; data: UserVoucherRecord; message?: string }>(`/vouchers/${voucherId}/save`, {}).pipe(
      tap(response => {
        if (response.data) {
          this._userVouchers.update(current => [
            response.data,
            ...current.filter(item => item._id !== response.data._id),
          ]);
        }
      })
    );
  }

  collectVoucher(voucherId: string): boolean {
    if (this.isSaved(voucherId)) return false;
    this.saveVoucher(voucherId).subscribe({
      error: () => {},
    });
    return true;
  }

  saveVoucherByCode(code: string): Observable<{ success: boolean; data: UserVoucherRecord; message?: string }> {
    return this.api.post<{ success: boolean; data: UserVoucherRecord; message?: string }>(`/vouchers/code/${encodeURIComponent(code.trim().toUpperCase())}/save`, {}).pipe(
      tap(response => {
        if (response.data) {
          this._userVouchers.update(current => [
            response.data,
            ...current.filter(item => item._id !== response.data._id),
          ]);
        }
      })
    );
  }

  getAvailableForCheckout(orderTotal: number): Observable<{ success: boolean; data: CheckoutVoucherRecord[] }> {
    return this.api.get<{ success: boolean; data: CheckoutVoucherRecord[] }>('/vouchers/available-for-checkout', {
      orderTotal,
    });
  }

  validateVoucher(code: string, orderTotal: number): Observable<{ success: boolean; data: VoucherValidation }> {
    return this.api.post<{ success: boolean; data: VoucherValidation }>('/vouchers/validate', {
      code: code.trim().toUpperCase(),
      orderTotal,
    });
  }
}
