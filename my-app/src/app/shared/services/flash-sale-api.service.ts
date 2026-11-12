import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';

export interface FlashSaleItem {
  _id: string;
  productId: string;
  name: string;
  slug: string;
  category: string;
  description: string;
  image: string;
  originalPrice: number;
  flashSalePrice: number;
  discountPercent: number;
  totalQuantity: number;
  soldQuantity: number;
  soldPercent: number;
  stock?: number;
  isSoldOut: boolean;
  startDate: string;
  endDate: string;
  isActive: boolean;
}

@Injectable({ providedIn: 'root' })
export class FlashSaleApiService {
  private api = inject(ApiService);

  getActive() {
    return this.api.get<{ success: boolean; count: number; data: FlashSaleItem[] }>('/flash-sales/active');
  }

  getAll() {
    return this.api.get<{ success: boolean; count: number; data: FlashSaleItem[] }>('/flash-sales');
  }
}

