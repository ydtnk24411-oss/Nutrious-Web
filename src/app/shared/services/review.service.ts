import { Injectable, signal, inject } from '@angular/core';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { ProductReview, ReviewStats } from '../models/xanh-la.models';
import { ApiService } from './api.service';

const EMPTY_STATS: ReviewStats = {
  averageRating: 0,
  totalReviews: 0,
  ratingDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
};

/**
 * Đánh giá sản phẩm lưu trên server. Người đánh giá luôn là tài khoản đang đăng nhập
 * (server lấy từ token), "đã mua hàng" do server kiểm tra từ lịch sử đơn của tài khoản.
 */
@Injectable({ providedIn: 'root' })
export class ReviewService {
  private api = inject(ApiService);

  private _reviews = signal<Record<string, ProductReview[]>>({});
  private _stats   = signal<Record<string, ReviewStats>>({});

  readonly reviews = this._reviews.asReadonly();
  readonly stats   = this._stats.asReadonly();

  /** Tải đánh giá của một sản phẩm từ server. */
  load(productId: string): void {
    if (!productId) return;
    this.api.get<{ success: boolean; data: ProductReview[]; stats: ReviewStats }>(
      `/reviews/product/${productId}`
    ).subscribe({
      next: (res) => {
        if (!res.success) return;
        this._reviews.update(m => ({ ...m, [productId]: res.data }));
        this._stats.update(m => ({ ...m, [productId]: res.stats }));
      },
      error: () => { /* giữ dữ liệu cũ */ },
    });
  }

  // Get reviews for a specific product
  getProductReviews(productId: string): ProductReview[] {
    return this._reviews()[productId] ?? [];
  }

  // Get stats for a specific product
  getProductStats(productId: string): ReviewStats {
    return this._stats()[productId] ?? EMPTY_STATS;
  }

  // Add a new review (server gắn tài khoản từ token)
  addReview(review: { productId: string; productName: string; rating: number; title?: string; content: string }): Observable<unknown> {
    return this.api.post('/reviews', review).pipe(tap(() => this.load(review.productId)));
  }

  // Mark review as helpful (mỗi tài khoản 1 lần)
  markHelpful(reviewId: string, productId: string): Observable<unknown> {
    return this.api.post(`/reviews/${reviewId}/helpful`, {}).pipe(tap(() => this.load(productId)));
  }

  // Filter reviews
  filterReviews(
    productId: string,
    filter: 'all' | '5' | '4' | '3' | '2' | '1' | 'latest' | 'withImages'
  ): ProductReview[] {
    const reviews = [...this.getProductReviews(productId)];

    switch (filter) {
      case 'latest':
        return reviews.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      case 'withImages':
        return reviews.filter(r => r.images && r.images.length > 0);
      case '5':
      case '4':
      case '3':
      case '2':
      case '1':
        return reviews.filter(r => r.rating === parseInt(filter));
      default:
        return reviews;
    }
  }
}
