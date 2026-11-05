import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';

export interface ApiEvent {
  _id: string;
  name: string;
  slug: string;
  date: string;
  time: string;
  location: string;
  description: string;
  image: string;
  action: string;
  isActive: boolean;
  capacity: number;
  registrations?: { name: string; email: string; phone?: string; createdAt: string }[];
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class EventApiService {
  private api = inject(ApiService);

  getAll() {
    return this.api.get<{ success: boolean; data: ApiEvent[] }>('/events');
  }

  getAllAdmin() {
    return this.api.get<{ success: boolean; data: ApiEvent[] }>('/events/admin/all');
  }

  getBySlug(slug: string) {
    return this.api.get<{ success: boolean; data: ApiEvent }>(`/events/${slug}`);
  }

  register(slug: string, body: { name: string; email: string; phone?: string }) {
    return this.api.post<{ success: boolean; message: string }>(`/events/${slug}/register`, body);
  }

  create(body: Partial<ApiEvent>) {
    return this.api.post<{ success: boolean; data: ApiEvent }>('/events', body);
  }

  update(id: string, body: Partial<ApiEvent>) {
    return this.api.put<{ success: boolean; data: ApiEvent }>(`/events/${id}`, body);
  }

  remove(id: string) {
    return this.api.delete<{ success: boolean }>(`/events/${id}`);
  }
}
