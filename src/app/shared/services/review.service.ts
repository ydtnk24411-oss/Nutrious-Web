import { Injectable, signal, computed } from '@angular/core';
import { ProductReview, ReviewStats } from '../models/xanh-la.models';

const REVIEWS_KEY = 'xanhla_reviews';
const STATS_KEY = 'xanhla_review_stats';

@Injectable({ providedIn: 'root' })
export class ReviewService {
  private _reviews = signal<ProductReview[]>(this._loadReviews());
  private _stats = signal<Record<string, ReviewStats>>(this._loadStats());

  readonly reviews = this._reviews.asReadonly();
  readonly stats = this._stats.asReadonly();

  // Mock sample reviews
  private sampleReviews: ProductReview[] = [
    {
      id: '1',
      productId: 'sample1',
      productName: 'Rau Muống Tươi',
      userId: 'user1',
      userName: 'Nguyễn Văn A',
      rating: 5,
      title: 'Rau rất tươi',
      content: 'Rau muống rất tươi xanh, không bị hé. Mua nhiều lần rồi, chất lượng luôn ổn định.',
      images: [],
      helpfulCount: 12,
      createdAt: '2025-10-10T10:00:00Z',
      verifiedPurchase: true,
    },
    {
      id: '2',
      productId: 'sample1',
      productName: 'Rau Muống Tươi',
      userId: 'user2',
      userName: 'Trần Thị B',
      rating: 4,
      content: 'Rau tươi nhưng hơi nhỏ so với mô tả. Nhìn chung vẫn hài lòng.',
      images: [],
      helpfulCount: 5,
      createdAt: '2025-10-08T15:30:00Z',
      verifiedPurchase: true,
    },
    {
      id: '3',
      productId: 'sample2',
      productName: 'Cà Rốt Baby Đà Lạt',
      userId: 'user3',
      userName: 'Lê Văn C',
      rating: 5,
      title: 'Ngọt và giòn',
      content: 'Cà rốt rất ngọt, giòn, màu sắc đẹp. Con tôi rất thích ăn sống.',
      images: [],
      helpfulCount: 8,
      createdAt: '2025-10-05T09:15:00Z',
      verifiedPurchase: true,
    },
  ];

  constructor() {
    // Initialize with sample data if empty
    if (this._reviews().length === 0) {
      this._reviews.set(this.sampleReviews);
      this._saveReviews();
      this._rebuildStats();
    }
  }

  // Get reviews for a specific product
  getProductReviews(productId: string): ProductReview[] {
    return this._reviews().filter(r => r.productId === productId);
  }

  // Get stats for a specific product
  getProductStats(productId: string): ReviewStats {
    return this._stats()[productId] || {
      averageRating: 0,
      totalReviews: 0,
      ratingDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
    };
  }

  // Add a new review
  addReview(review: Omit<ProductReview, 'id' | 'createdAt' | 'helpfulCount'>): void {
    const newReview: ProductReview = {
      ...review,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
      helpfulCount: 0,
    };
    this._reviews.update(r => [newReview, ...r]);
    this._saveReviews();
    this._rebuildStats();
  }

  // Mark review as helpful
  markHelpful(reviewId: string): void {
    this._reviews.update(r =>
      r.map(review =>
        review.id === reviewId
          ? { ...review, helpfulCount: review.helpfulCount + 1, isHelpful: true }
          : review
      )
    );
    this._saveReviews();
  }

  // Filter reviews
  filterReviews(
    productId: string,
    filter: 'all' | '5' | '4' | '3' | '2' | '1' | 'latest' | 'withImages'
  ): ProductReview[] {
    let reviews = this.getProductReviews(productId);

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

  // Check if user can review (simplified - check if user has purchased)
  canReview(userId: string, productId: string): boolean {
    // TODO: Integrate with order history
    // For now, return true for demo
    return true;
  }

  private _loadReviews(): ProductReview[] {
    try {
      const data = localStorage.getItem(REVIEWS_KEY);
      return data ? JSON.parse(data) : [];
    } catch {
      return [];
    }
  }

  private _saveReviews(): void {
    try {
      localStorage.setItem(REVIEWS_KEY, JSON.stringify(this._reviews()));
    } catch {
      // Ignore storage errors
    }
  }

  private _loadStats(): Record<string, ReviewStats> {
    try {
      const data = localStorage.getItem(STATS_KEY);
      return data ? JSON.parse(data) : {};
    } catch {
      return {};
    }
  }

  private _saveStats(): void {
    try {
      localStorage.setItem(STATS_KEY, JSON.stringify(this._stats()));
    } catch {
      // Ignore storage errors
    }
  }

  private _rebuildStats(): void {
    const statsMap: Record<string, ReviewStats> = {};

    for (const review of this._reviews()) {
      if (!statsMap[review.productId]) {
        statsMap[review.productId] = {
          averageRating: 0,
          totalReviews: 0,
          ratingDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
        };
      }

      const stats = statsMap[review.productId];
      stats.totalReviews++;
      stats.ratingDistribution[review.rating as keyof typeof stats.ratingDistribution]++;

      // Calculate average
      const total = stats.totalReviews;
      const sum = Object.entries(stats.ratingDistribution).reduce(
        (acc, [rating, count]) => acc + parseInt(rating) * count,
        0
      );
      stats.averageRating = total > 0 ? Math.round((sum / total) * 10) / 10 : 0;
    }

    this._stats.set(statsMap);
    this._saveStats();
  }
}
