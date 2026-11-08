import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';

export interface ApiComboItem {
  product: Pick<ApiProduct, '_id' | 'name' | 'slug' | 'image' | 'price' | 'priceNumber' | 'unit' | 'weight' | 'stock'>;
  quantity: number;
}

export interface ApiAddOnDeal {
  product: Pick<ApiProduct, '_id' | 'name' | 'slug' | 'image' | 'price' | 'priceNumber' | 'unit' | 'weight' | 'stock' | 'isActive' | 'isCombo' | 'category' | 'categoryVi'> | string;
  discountType: 'percent' | 'fixed';
  discountValue: number;
  isActive: boolean;
}

export interface ApiProduct {
  _id: string;
  name: string;
  slug: string;
  price: string;
  priceNumber: number;
  image: string;
  categoryId: string;
  category?: string;
  categoryVi?: string;
  description: string;
  brand?: string;
  manufacturer?: string;
  origin?: string;
  unit?: string;
  storageInstructions?: string;
  usageInstructions?: string;
  specifications?: Record<string, string>;
  isCombo?: boolean;
  comboItems?: ApiComboItem[];
  originalPriceNumber?: number;
  addOnDeals?: ApiAddOnDeal[];
  stock: number;
  isActive: boolean;
  container: string; cutType: string; cutting: string;
  packSize: string; packaging: string; preparation: string;
  quantity: string; ripeness: string; sizeGroup: string;
  thickness: string; type: string; weight: string;
  options?: { name: string; values: string[] }[];
  createdAt: string;
}
export interface ApiCategory {
  _id: string;
  name: string;
  slug: string;
  image?: string;
  order: number;
  isActive: boolean;
  createdAt?: string;
}

@Injectable({ providedIn: 'root' })
export class ProductApiService {
  private api = inject(ApiService);

  getCategories() {
    return this.api.get<{ success: boolean; data: ApiCategory[] }>('/categories');
  }

  getAll(params?: Record<string, string | number>) {
    return this.api.get<{ success: boolean; total: number; data: ApiProduct[] }>('/products', params);
  }

  getBySlug(slug: string) {
    return this.api.get<{ success: boolean; data: ApiProduct }>(`/products/${slug}`);
  }

  getRelated(slug: string, limit: number = 8) {
    return this.api.get<{ success: boolean; data: ApiProduct[] }>(`/products/${slug}/related`, { limit });
  }

  getCombos(slug: string, limit: number = 3) {
    return this.api.get<{ success: boolean; data: ApiProduct[] }>(`/products/${slug}/combos`, { limit });
  }

  create(body: Partial<ApiProduct>) {
    return this.api.post<{ success: boolean; data: ApiProduct }>('/products', body);
  }

  update(id: string, body: Partial<ApiProduct>) {
    return this.api.put<{ success: boolean; data: ApiProduct }>(`/products/${id}`, body);
  }

  remove(id: string) {
    return this.api.delete<{ success: boolean }>(`/products/${id}`);
  }
}
