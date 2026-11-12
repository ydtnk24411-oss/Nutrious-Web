import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';
import { ApiProduct } from './product-api.service';

export type ComboStatus = 'active' | 'paused' | 'hidden';

export interface ComboAdminSummary {
  totalCombos: number;
  activeCount: number;
  pausedCount: number;
  hiddenCount: number;
  outOfStockCount: number;
}

export interface ComboUpsertItem {
  product: string;
  quantity: number;
}

export interface ComboUpsertPayload {
  name: string;
  slug?: string;
  description: string;
  image: string;
  priceNumber: number;
  comboStatus: ComboStatus;
  comboItems: ComboUpsertItem[];
}

export interface ComboListResponse {
  success: boolean;
  total: number;
  page: number;
  summary: ComboAdminSummary;
  data: ApiProduct[];
}

@Injectable({ providedIn: 'root' })
export class ComboApiService {
  private api = inject(ApiService);

  getAll(params?: Record<string, string | number>) {
    return this.api.get<ComboListResponse>('/combos', params);
  }

  getById(id: string) {
    return this.api.get<{ success: boolean; data: ApiProduct }>(`/combos/${id}`);
  }

  create(payload: ComboUpsertPayload) {
    return this.api.post<{ success: boolean; data: ApiProduct }>('/combos', payload);
  }

  update(id: string, payload: ComboUpsertPayload) {
    return this.api.put<{ success: boolean; data: ApiProduct }>(`/combos/${id}`, payload);
  }

  updateStatus(id: string, comboStatus: ComboStatus) {
    return this.api.patch<{ success: boolean; data: ApiProduct }>(
      `/combos/${id}/status`,
      { comboStatus }
    );
  }

  remove(id: string) {
    return this.api.delete<{ success: boolean; message?: string }>(`/combos/${id}`);
  }
}
