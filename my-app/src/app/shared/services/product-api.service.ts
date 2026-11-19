import { Injectable, inject } from '@angular/core';
import { of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { ApiService } from './api.service';

export interface ApiComboLimitingItem {
  productId: string;
  name: string;
  productStock: number;
  requiredQty: number;
  maxCombos: number;
  isInactive?: boolean;
}

export interface ApiComboItem {
  product: Pick<ApiProduct, '_id' | 'name' | 'slug' | 'image' | 'price' | 'priceNumber' | 'unit' | 'weight' | 'stock' | 'isActive' | 'category' | 'categoryVi'>;
  quantity: number;
  lineTotal?: number;
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
  images?: string[];
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
  comboStatus?: 'active' | 'paused' | 'hidden';
  comboItems?: ApiComboItem[];
  originalPriceNumber?: number;
  retailTotal?: number;
  savingAmount?: number;
  savingPercent?: number;
  availableStock?: number;
  limitingItem?: ApiComboLimitingItem | null;
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

  private catalogCache = new Map<string, { data: { success: boolean; total: number; data: ApiProduct[] }; time: number }>();

  getAll(params?: Record<string, string | number>) {
    const key = JSON.stringify(params || {});
    const cached = this.catalogCache.get(key);
    if (cached && (Date.now() - cached.time < 300000)) {
      return of(cached.data);
    }
    return this.api.get<{ success: boolean; total: number; data: ApiProduct[] }>('/products', params).pipe(
      tap(res => {
        if (res && res.success) {
          this.catalogCache.set(key, { data: res, time: Date.now() });
        }
      })
    );
  }

  clearCatalogCache() {
    this.catalogCache.clear();
  }

  getBySlug(slug: string) {
    return this.api.get<{ success: boolean; data: ApiProduct }>(`/products/${slug}`);
  }

  getRelated(slug: string, limit: number = 8) {
    return this.api.get<{ success: boolean; data: ApiProduct[] }>(`/products/${slug}/related`, { limit });
  }

  getFrequentlyBought(slug: string, limit: number = 2) {
    return this.api.get<{ success: boolean; data: ApiProduct[] }>(`/products/${slug}/frequently-bought`, { limit });
  }

  getCombos(slug: string, limit: number = 3) {
    return this.api.get<{ success: boolean; data: ApiProduct[] }>(`/products/${slug}/combos`, { limit });
  }

  create(body: Partial<ApiProduct>) {
    this.clearCatalogCache();
    return this.api.post<{ success: boolean; data: ApiProduct }>('/products', body);
  }

  update(id: string, body: Partial<ApiProduct>) {
    this.clearCatalogCache();
    return this.api.put<{ success: boolean; data: ApiProduct }>(`/products/${id}`, body);
  }

  remove(id: string) {
    this.clearCatalogCache();
    return this.api.delete<{ success: boolean }>(`/products/${id}`);
  }

  checkStoreStock(storeId: string, items: { productId?: string; slug?: string; quantity: number }[]) {
    return this.api.post<{
      success: boolean;
      storeId: string;
      storeName: string;
      hasShortage: boolean;
      items: {
        productId: string;
        slug: string;
        name: string;
        requestedQty: number;
        availableStock: number;
        maxQty: number;
        isShortage: boolean;
      }[];
      shortages: {
        productId: string;
        slug: string;
        name: string;
        requestedQty: number;
        availableStock: number;
        message: string;
      }[];
    }>('/products/check-store-stock', { storeId, items });
  }
}
