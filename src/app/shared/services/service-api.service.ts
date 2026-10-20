import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';

export interface ApiService2 {
  _id: string;
  name: string;
  slug: string;
  subtitle: string;
  price: string;
  priceNumber: number;
  description: string;
  status: string;
  action: string;
  isActive: boolean;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class ServiceApiService {
  private api = inject(ApiService);

  getAll() {
    return this.api.get<{ success: boolean; data: ApiService2[] }>('/services');
  }

  getBySlug(slug: string) {
    return this.api.get<{ success: boolean; data: ApiService2 }>(`/services/${slug}`);
  }
}
