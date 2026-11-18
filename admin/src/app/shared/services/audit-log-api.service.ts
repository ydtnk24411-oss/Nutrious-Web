import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';

export interface AuditLogItem {
  _id: string;
  actor: string | null;
  actorName: string;
  actorEmail: string;
  actorRole: string;
  action: string;
  category: 'STAFF' | 'ORDER' | 'INVENTORY' | 'VOUCHER' | 'PRODUCT' | 'FINANCE' | 'SYSTEM';
  targetType?: string;
  targetId?: string;
  details: string;
  metadata?: Record<string, any>;
  ipAddress?: string;
  status: 'SUCCESS' | 'FAILED';
  createdAt: string;
}

export interface AuditLogStats {
  totalToday: number;
  byCategory: { _id: string; count: number }[];
  byRole: { _id: string; count: number }[];
}

@Injectable({ providedIn: 'root' })
export class AuditLogApiService {
  private api = inject(ApiService);

  getAll(params?: Record<string, string | number>) {
    return this.api.get<{
      success: boolean;
      data: AuditLogItem[];
      total: number;
      page: number;
      totalPages: number;
    }>('/audit-logs', params);
  }

  getStats() {
    return this.api.get<{ success: boolean; data: AuditLogStats }>('/audit-logs/stats');
  }
}
