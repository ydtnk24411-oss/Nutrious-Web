import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';

export interface ApiOrder {
  _id: string;
  orderCode: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  items: {
    productName: string;
    productImage: string;
    productPrice: string;
    priceNumber: number;
    quantity: number;
    selectedOption?: string;
    isCombo?: boolean;
    comboItems?: {
      product?: any;
      name?: string;
      price?: string;
      image?: string;
      weight?: string;
      unit?: string;
      quantity?: number;
    }[];
    originalPriceNumber?: number;
    comboSaving?: number;
    itemType?: 'regular' | 'combo' | 'addon';
    linkedMainProduct?: string;
    linkedMainProductName?: string;
    addonDiscountType?: string;
    addonDiscountValue?: number;
    addonSaving?: number;
    discountedByAddon?: boolean;
    promoNote?: string;
  }[];
  subtotal: number;
  discount?: number;
  comboDiscount?: number;
  addonDiscount?: number;
  voucherCode?: string;
  total: number;
  shippingFee?: number;
  shippingDiscount?: number;
  shippingDistanceKm?: number;
  shippingCoordinates?: { lat: number; lng: number };
  estimatedDeliveryTime?: string;
  shippingMethod: 'pickup' | 'delivery';
  shippingAddress: string;
  paymentMethod: 'cod' | 'bank_transfer';
  status: 'pending' | 'confirmed' | 'preparing' | 'shipping' | 'delivered' | 'cancelled';
  note: string;
  createdAt: string;
  user?: { name: string; email: string };
}

@Injectable({ providedIn: 'root' })
export class OrderApiService {
  private api = inject(ApiService);

  getMyOrders(params?: Record<string, string | number>) {
    return this.api.get<{ success: boolean; total: number; data: ApiOrder[] }>('/orders/my', params);
  }

  getByCode(code: string) {
    return this.api.get<{ success: boolean; data: ApiOrder }>(`/orders/${code}`);
  }

  getAll(params?: Record<string, string | number>) {
    return this.api.get<{ success: boolean; total: number; data: ApiOrder[] }>('/orders', params);
  }

  getById(id: string) {
    return this.api.get<{ success: boolean; data: ApiOrder }>(`/orders/${id}`);
  }

  track(code: string) {
    return this.api.get<{ success: boolean; data: ApiOrder }>(`/orders/track/${code}`);
  }

  create(body: Partial<ApiOrder>) {
    return this.api.post<{ success: boolean; data: { orderCode: string; _id: string } }>('/orders', body);
  }

  cancel(idOrCode: string, reason?: string) {
    return this.api.put<{ success: boolean; message: string; data: ApiOrder }>(`/orders/${idOrCode}/cancel`, { reason });
  }

  updateStatus(id: string, status: ApiOrder['status']) {
    return this.api.put<{ success: boolean; data: ApiOrder }>(`/orders/${id}/status`, { status });
  }
}
