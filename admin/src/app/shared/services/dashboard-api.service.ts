import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';

export interface DashboardStats {
  totalProducts: number;
  totalOrders: number;
  totalUsers: number;
  pendingOrders: number;
  totalRevenue: number;
  averageOrderValue: number;
  lowStockCount?: number;
  outOfStockCount?: number;
  pendingComplaintsCount?: number;
  waitingSupportCount?: number;
  activeVouchersCount?: number;
  reviewStats?: { averageRating: number; totalReviews: number };
  recentOrders: {
    _id: string;
    orderCode: string;
    guestName: string;
    total: number;
    status: string;
    createdAt: string;
  }[];
  ordersByStatus: { _id: string; count: number }[];
}

export interface TopProduct {
  name: string;
  quantity: number;
  revenue: number;
  image?: string;
}

export interface RevenueData {
  date: string;
  revenue: number;
  count: number;
}

export interface CategoryRevenue {
  label: string;
  slug: string;
  revenue: number;
}

export interface FinanceSummary {
  validOrdersCount: number;
  cancelledOrdersCount: number;
  grossRevenue: number;
  voucherDiscount: number;
  comboDiscount: number;
  addonDiscount: number;
  shippingDiscount: number;
  totalDiscount: number;
  shippingRevenue: number;
  netRevenue: number;
  collectedAmount: number;
  pendingAmount: number;
  cancelledAmount: number;
  codAmount: number;
  codCount: number;
  vietqrAmount: number;
  vietqrCount: number;
  vietqrPaidAmount: number;
  vietqrPendingAmount: number;
  estimatedCogs: number;
  estimatedOps: number;
  estimatedProfit: number;
  profitMargin: number;
  avgOrderValue: number;
}

export interface StoreFinanceItem {
  storeName: string;
  address: string;
  isHeadquarter: boolean;
  orderCount: number;
  cancelledCount: number;
  grossRevenue: number;
  voucherDiscount: number;
  comboDiscount: number;
  addonDiscount: number;
  shippingDiscount: number;
  totalDiscount: number;
  shippingRevenue: number;
  netRevenue: number;
  collectedAmount: number;
  pendingAmount: number;
  cancelledAmount: number;
  codAmount: number;
  codCount: number;
  vietqrAmount: number;
  vietqrCount: number;
  vietqrPaidAmount: number;
  vietqrPendingAmount: number;
  estimatedCogs: number;
  estimatedOps: number;
  estimatedProfit: number;
  profitMargin: number;
  avgOrderValue: number;
  revenueShare: number;
}

export interface FinanceTransaction {
  _id: string;
  orderCode: string;
  storeName: string;
  customer: string;
  shippingMethod: string;
  paymentMethod: string;
  paymentStatus: string;
  status: string;
  subtotal: number;
  totalDiscount: number;
  shippingFee: number;
  total: number;
  estimatedProfit: number;
  isCollected: boolean;
  createdAt: string;
}

export interface FinanceReportData {
  summary: FinanceSummary;
  stores: StoreFinanceItem[];
  transactions: FinanceTransaction[];
}

@Injectable({ providedIn: 'root' })
export class DashboardApiService {
  private api = inject(ApiService);

  getStats(startDate?: string, endDate?: string) {
    const params: Record<string, string | number> = {};
    if (startDate) params['startDate'] = startDate;
    if (endDate) params['endDate'] = endDate;
    return this.api.get<{ success: boolean; data: DashboardStats }>('/dashboard/stats', params);
  }

  getRevenue(startDate?: string, endDate?: string) {
    const params: Record<string, string | number> = {};
    if (startDate) params['startDate'] = startDate;
    if (endDate) params['endDate'] = endDate;
    return this.api.get<{ success: boolean; data: RevenueData[] }>('/dashboard/revenue', params);
  }

  getRevenueByCategory(startDate?: string, endDate?: string) {
    const params: Record<string, string | number> = {};
    if (startDate) params['startDate'] = startDate;
    if (endDate) params['endDate'] = endDate;
    return this.api.get<{ success: boolean; data: CategoryRevenue[] }>('/dashboard/revenue-by-category', params);
  }

  getTopProducts(startDate?: string, endDate?: string, limit = 5) {
    const params: Record<string, string | number> = { limit };
    if (startDate) params['startDate'] = startDate;
    if (endDate) params['endDate'] = endDate;
    return this.api.get<{ success: boolean; data: TopProduct[] }>('/dashboard/top-products', params);
  }

  getFinance(startDate?: string, endDate?: string, store?: string) {
    const params: Record<string, string | number> = {};
    if (startDate) params['startDate'] = startDate;
    if (endDate) params['endDate'] = endDate;
    if (store) params['store'] = store;
    return this.api.get<{ success: boolean; data: FinanceReportData }>('/dashboard/finance', params);
  }
}
