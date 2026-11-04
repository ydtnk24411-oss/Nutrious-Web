import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';

export type UserRole = 'customer' | 'admin' | 'sales' | 'warehouse' | 'support' | 'content';

export interface ApiUser {
  _id: string;
  name: string;
  email: string;
  phone: string;
  avatar?: string;
  role: UserRole;
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

  createStaff(body: { name: string; email: string; password?: string; role: UserRole; phone?: string }) {
    return this.api.post<{ success: boolean; data: ApiUser }>('/users/staff', body);
  }

  update(id: string, body: Partial<ApiUser> & { password?: string }) {
    return this.api.put<{ success: boolean; data: ApiUser }>(`/users/${id}`, body);
  }

  updateRole(id: string, role: UserRole) {
    return this.api.put<{ success: boolean; data: ApiUser }>(`/users/${id}`, { role });
  }

  toggleActive(id: string, isActive: boolean) {
    return this.api.put<{ success: boolean; data: ApiUser }>(`/users/${id}`, { isActive });
  }

  remove(id: string) {
    return this.api.delete<{ success: boolean }>(`/users/${id}`);
  }
}
