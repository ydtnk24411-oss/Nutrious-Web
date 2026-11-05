import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';

export interface AdminVoucher {
  _id: string;
  code: string;
  name: string;
  description?: string;
  discountType: 'percentage' | 'fixed';
  discountValue: number;
  minOrderValue: number;
  maxDiscountValue?: number | null;
  pointsRequired: number;
  startDate: string;
  endDate: string;
  usageLimit: number;
  usedCount: number;
  isActive: boolean;
  applicableCategories?: string[];
  createdAt?: string;
}

export interface VoucherStats {
  total: number;
  active: number;
  expired: number;
  totalUsed: number;
}

@Injectable({ providedIn: 'root' })
export class VoucherAdminApiService {
  private api = inject(ApiService);

  getAll(params?: Record<string, string | number>) {
    return this.api.get<{
      success: boolean;
      data: AdminVoucher[];
      stats: VoucherStats;
      total: number;
    }>('/vouchers/admin', params);
  }

  create(voucher: Partial<AdminVoucher>) {
    return this.api.post<{ success: boolean; data: AdminVoucher }>('/vouchers', voucher);
  }

  update(id: string, voucher: Partial<AdminVoucher>) {
    return this.api.put<{ success: boolean; data: AdminVoucher }>(`/vouchers/${id}`, voucher);
  }

  toggleActive(id: string, isActive: boolean) {
    return this.api.put<{ success: boolean; data: AdminVoucher }>(`/vouchers/${id}`, { isActive });
  }

  remove(id: string) {
    return this.api.delete<{ success: boolean }>(`/vouchers/${id}`);
  }
}

