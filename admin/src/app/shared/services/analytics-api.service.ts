import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';

export interface AnalyticsOverview {
  traffic: {
    totalPageviews: number;
    totalSessions: number;
    totalUsers: number;
    newUsers: number;
    returningUsers: number;
    avgDurationSeconds: number;
    bounceRate: number;
    avgPagesPerSession: number;
    sources: { _id: string; count: number }[];
    devices: { _id: string; count: number }[];
  };
  searchDiscovery: {
    totalSearches: number;
    searchNoResultRate: number;
    popularKeywords: { keyword: string; count: number }[];
    categoryViews: number;
    productDetailViews: number;
    avgProductViewDuration: number;
    topViewedProducts: { _id: string; count: number; price?: number }[];
    imageClicks: number;
    optionVariantClicks: number;
  };
  cartCheckout: {
    addToCartCount: number;
    removeFromCartCount: number;
    cartAbandonmentRate: number;
    averageCartValue: number;
    beginCheckoutCount: number;
    shippingCompleteRate: number;
    paymentCompleteRate: number;
    checkoutAbandonmentRate: number;
  };
  salesConversion: {
    completedOrders: number;
    conversionRate: number;
    websiteRevenue: number;
    averageOrderValue: number;
    repeatCustomerRate: number;
    ctaClicks: number;
    ctaClickRate: number;
    inboxClicks: number;
    contactInfoClicks: number;
    totalContactCount: number;
  };
  performanceHealth: {
    errorCount: number;
    errorRate: number;
    avgLoadTimeMs: number;
    mobilePerformanceScore: number;
  };
}

@Injectable({ providedIn: 'root' })
export class AnalyticsApiService {
  private api = inject(ApiService);

  getOverview(params?: { range?: string; startDate?: string; endDate?: string }) {
    return this.api.get<{ success: boolean; data: AnalyticsOverview }>('/analytics/overview', params);
  }
}
