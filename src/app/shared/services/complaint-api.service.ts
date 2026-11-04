import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';

export type ComplaintType = 'product' | 'delivery' | 'order' | 'payment' | 'other';
export type ComplaintStatus = 'pending' | 'processing' | 'resolved' | 'rejected';

export interface ComplaintItem {
  _id: string;
  complaintCode: string;
  customer?: {
    _id: string;
    name: string;
    email: string;
    phone?: string;
  };
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  order?: {
    _id: string;
    orderCode: string;
    total: number;
    createdAt: string;
  };
  type: ComplaintType;
  title: string;
  description: string;
  images?: string[];
  status: ComplaintStatus;
  resolutionNote?: string;
  resolvedAt?: string;
  assignedTo?: {
    _id: string;
    name: string;
    email: string;
  };
  createdAt: string;
  updatedAt: string;
}

export interface ComplaintStats {
  total: number;
  pending: number;
  processing: number;
  resolved: number;
  rejected: number;
}

@Injectable({ providedIn: 'root' })
export class ComplaintApiService {
  private api = inject(ApiService);

  getAll(params?: Record<string, string | number>) {
    return this.api.get<{
      success: boolean;
      data: ComplaintItem[];
      stats: ComplaintStats;
      total: number;
    }>('/complaints', params);
  }

  getById(id: string) {
    return this.api.get<{ success: boolean; data: ComplaintItem }>(`/complaints/${id}`);
  }

  create(body: Partial<ComplaintItem>) {
    return this.api.post<{ success: boolean; data: ComplaintItem }>('/complaints', body);
  }

  update(id: string, body: { status?: ComplaintStatus; resolutionNote?: string; assignedTo?: string }) {
    return this.api.put<{ success: boolean; data: ComplaintItem }>(`/complaints/${id}`, body);
  }
}

