import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';

export interface ApiCategory {
  _id: string;
  name: string;
  slug: string;
  image: string;
  order: number;
  isActive: boolean;
  productCount?: number;
}

@Injectable({ providedIn: 'root' })
export class CategoryApiService {
  private api = inject(ApiService);

  getAll() {
    return this.api.get<{ success: boolean; data: ApiCategory[] }>('/categories');
  }

  getWithCounts() {
    return this.api.get<{ success: boolean; data: ApiCategory[] }>('/categories/with-counts');
  }

  create(body: Partial<ApiCategory>) {
    return this.api.post<{ success: boolean; data: ApiCategory }>('/categories', body);
  }

  update(id: string, body: Partial<ApiCategory>) {
    return this.api.put<{ success: boolean; data: ApiCategory }>(`/categories/${id}`, body);
  }

  remove(id: string) {
    return this.api.delete<{ success: boolean }>(`/categories/${id}`);
  }
}
