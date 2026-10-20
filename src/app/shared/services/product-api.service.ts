import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';

export interface ApiProduct {
  _id: string;
  name: string;
  slug: string;
  price: string;
  priceNumber: number;
  image: string;
  category: string;
  categoryVi: string;
  description: string;
  stock: number;
  isActive: boolean;
  container: string; cutType: string; cutting: string;
  packSize: string; packaging: string; preparation: string;
  quantity: string; ripeness: string; sizeGroup: string;
  thickness: string; type: string; weight: string;
  options?: { name: string; values: string[] }[];
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class ProductApiService {
  private api = inject(ApiService);

  getAll(params?: Record<string, string | number>) {
    return this.api.get<{ success: boolean; total: number; data: ApiProduct[] }>('/products', params);
  }

  getBySlug(slug: string) {
    return this.api.get<{ success: boolean; data: ApiProduct }>(`/products/${slug}`);
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
