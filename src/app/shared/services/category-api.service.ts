import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';

export interface ApiCategory {
  _id: string;
  name: string;
  slug: string;
  image: string;
  order: number;
  isActive: boolean;
}

@Injectable({ providedIn: 'root' })
export class CategoryApiService {
  private api = inject(ApiService);

  getAll() {
    return this.api.get<{ success: boolean; data: ApiCategory[] }>('/categories');
  }
}
