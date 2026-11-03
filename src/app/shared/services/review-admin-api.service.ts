import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';

export interface AdminReviewItem {
  _id: string;
  product: string;
  productName: string;
  user: {
    _id: string;
    name: string;
    email: string;
    avatar?: string;
  } | string;
  userName: string;
  rating: number;
  title?: string;
  content: string;
  images?: string[];
  helpfulBy?: string[];
  verifiedPurchase: boolean;
  adminReply?: string;
  adminReplyAt?: string;
  isHidden?: boolean;
  createdAt: string;
}

export interface ReviewAdminStats {
  total: number;
  averageRating: number;
  ratingDistribution: Record<number, number>;
  pendingReplyCount: number;
}

@Injectable({ providedIn: 'root' })
export class ReviewAdminApiService {
  private api = inject(ApiService);

  getAll(params?: Record<string, string | number>) {
    return this.api.get<{
      success: boolean;
      data: AdminReviewItem[];
      stats: ReviewAdminStats;
      total: number;
    }>('/reviews/admin', params);
  }

  reply(id: string, reply: string) {
    return this.api.put<{ success: boolean; data: AdminReviewItem }>(`/reviews/${id}/reply`, { reply });
  }

  toggleHide(id: string, isHidden: boolean) {
    return this.api.put<{ success: boolean; data: AdminReviewItem }>(`/reviews/${id}/hide`, { isHidden });
  }

  remove(id: string) {
    return this.api.delete<{ success: boolean }>(`/reviews/${id}`);
  }
}

