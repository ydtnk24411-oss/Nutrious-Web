import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';

export interface ApiBooking {
  _id: string;
  service: string | { _id: string; name: string; price: string };
  serviceName: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  date: string;
  time: string;
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  note: string;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class BookingApiService {
  private api = inject(ApiService);

  getAll(params?: Record<string, string | number>) {
    return this.api.get<{ success: boolean; total: number; data: ApiBooking[] }>('/bookings', params);
  }

  create(body: Partial<ApiBooking>) {
    return this.api.post<{ success: boolean; data: ApiBooking }>('/bookings', body);
  }

  updateStatus(id: string, status: ApiBooking['status']) {
    return this.api.put<{ success: boolean; data: ApiBooking }>(`/bookings/${id}/status`, { status });
  }
}
