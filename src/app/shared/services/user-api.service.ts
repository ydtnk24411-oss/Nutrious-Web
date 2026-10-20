import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';

export interface ApiUser {
  _id: string;
  name: string;
  email: string;
  phone: string;
  role: 'customer' | 'admin';
  isActive: boolean;
  createdAt: string;
  totalSpent?: number;
  orderCount?: number;
  lastPurchaseDate?: string | null;
}

export interface ApiUserWithStats extends ApiUser {
  totalSpent: number;
  orderCount: number;
  lastPurchaseDate: string | null;
}

@Injectable({ providedIn: 'root' })
export class UserApiService {
  private api = inject(ApiService);

  getAll(params?: Record<string, string | number>) {
    return this.api.get<{ success: boolean; total: number; data: ApiUser[] }>('/users', params);
  }

  getWithStats(params?: Record<string, string | number>) {
    return this.api.get<{ success: boolean; total: number; data: ApiUserWithStats[] }>('/users/purchase-stats', params);
  }

  getById(id: string) {
    return this.api.get<{ success: boolean; data: ApiUser }>(`/users/${id}`);
  }

  update(id: string, body: Partial<ApiUser>) {
    return this.api.put<{ success: boolean; data: ApiUser }>(`/users/${id}`, body);
  }

  remove(id: string) {
    return this.api.delete<{ success: boolean }>(`/users/${id}`);
  }
}
