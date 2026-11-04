import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';

export interface InventoryItem {
  _id: string;
  name: string;
  slug: string;
  price: string;
  priceNumber: number;
  image: string;
  category: string;
  categoryVi: string;
  stock: number;
  minStock: number;
  unit: string;
  isActive: boolean;
  status: 'in_stock' | 'low_stock' | 'out_of_stock';
  updatedAt: string;
}

export interface InventoryLogItem {
  _id: string;
  product: { _id: string; name: string; image?: string } | string;
  productName: string;
  type: 'import' | 'export' | 'adjustment' | 'order_cancel' | 'order_confirmed';
  delta: number;
  oldStock: number;
  newStock: number;
  reason: string;
  note?: string;
  updatedBy?: { _id: string; name: string; email: string };
  createdAt: string;
}

export interface InventorySummary {
  totalProducts: number;
  inStockCount: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalStockQuantity: number;
}

@Injectable({ providedIn: 'root' })
export class InventoryApiService {
  private api = inject(ApiService);

  getItems(params?: Record<string, string | number>) {
    return this.api.get<{
      success: boolean;
      data: InventoryItem[];
      summary: InventorySummary;
      total: number;
      page: number;
    }>('/inventory', params);
  }

  adjustStock(body: {
    productId: string;
    delta?: number;
    newStock?: number;
    reason: string;
    note?: string;
  }) {
    return this.api.post<{ success: boolean; data: InventoryItem; log: InventoryLogItem }>(
      '/inventory/adjust',
      body
    );
  }

  getLogs(params?: Record<string, string | number>) {
    return this.api.get<{
      success: boolean;
      data: InventoryLogItem[];
      total: number;
    }>('/inventory/logs', params);
  }
}

