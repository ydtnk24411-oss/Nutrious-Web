import { Injectable, inject } from '@angular/core';
import { ApiService } from './api.service';

export interface InventoryItem {
  _id: string;
  name: string;
  slug: string;
  price: string;
  priceNumber: number;
  costPrice?: number;
  image: string;
  category: string;
  categoryVi: string;
  stock: number;
  minStock: number;
  unit: string;
  isActive: boolean;
  status: 'in_stock' | 'low_stock' | 'out_of_stock';
  safetyBuffer?: number;
  storePrice?: number;
  storeDiscountPrice?: number;
  updatedAt: string;
}

export interface InventoryLogItem {
  _id: string;
  product: { _id: string; name: string; image?: string } | string;
  productName: string;
  productCode?: string;
  productImage?: string;
  type: 'import' | 'export' | 'adjustment' | 'order_cancel' | 'order_confirmed';
  delta: number;
  oldStock: number;
  newStock: number;
  reason: string;
  note?: string;
  storeId?: string;
  storeName?: string;
  updatedBy?: { _id?: string; name: string; email?: string } | null;
  createdAt: string;
}

export interface InventorySummary {
  totalProducts: number;
  inStockCount: number;
  lowStockCount: number;
  outOfStockCount: number;
  totalStockQuantity: number;
}

export interface TicketItem {
  productId: string;
  productName: string;
  sku?: string;
  quantityDelta: number;
  unitPrice?: number;
  lossValue?: number;
  batchCode?: string;
  expDate?: string | null;
  reason?: string;
}

export interface StockAdjustmentTicket {
  _id: string;
  ticketCode: string;
  storeId: string;
  storeName: string;
  targetStoreId?: string;
  targetStoreName?: string;
  supplierId?: string;
  supplierName?: string;
  type: 'goods_receipt' | 'spoilage_writeoff' | 'cycle_count' | 'boris_return' | 'store_transfer';
  items: TicketItem[];
  totalAmount?: number;
  paidAmount?: number;
  paymentStatus?: 'unpaid' | 'partial' | 'paid';
  totalLossValue: number;
  maxShortageQuantity: number;
  requiresApproval: boolean;
  status: 'pending_approval' | 'approved' | 'rejected' | 'in_transit' | 'completed' | 'cancelled';
  createdBy?: { _id: string; name: string; email: string; role: string };
  creatorName?: string;
  creatorRole?: string;
  approvedBy?: { _id: string; name: string; email: string; role: string };
  approverName?: string;
  approvedAt?: string;
  rejectedReason?: string;
  note?: string;
  createdAt: string;
}

export interface SupplierItem {
  _id: string;
  code: string;
  name: string;
  phone?: string;
  address?: string;
  category?: string;
}

export interface SupplierDebtItem extends SupplierItem {
  contactPerson?: string;
  province?: string;
  region?: string;
  totalInboundOrders: number;
  totalAmount: number;
  paidAmount: number;
  remainingDebt: number;
}

export interface StoreInventoryConfig {
  _id?: string;
  storeId: string;
  productId: string;
  storeStock?: number;
  safetyBuffer: number;
  storePrice?: number | null;
  storeDiscountPrice?: number | null;
  isActive?: boolean;
}

@Injectable({ providedIn: 'root' })
export class InventoryApiService {
  private api = inject(ApiService);

  getItems(params?: Record<string, string | number>) {
    return this.api.get<{
      success: boolean;
      data: InventoryItem[];
      summary: InventorySummary;
      total: number;
      page: number;
    }>('/inventory', params);
  }

  adjustStock(body: {
    productId: string;
    delta?: number;
    newStock?: number;
    reason: string;
    note?: string;
  }) {
    return this.api.post<{ success: boolean; data: InventoryItem; log: InventoryLogItem }>(
      '/inventory/adjust',
      body
    );
  }

  getLogs(params?: Record<string, string | number>) {
    return this.api.get<{
      success: boolean;
      data: InventoryLogItem[];
      total: number;
    }>('/inventory/logs', params);
  }

  getAdjustmentTickets(params?: Record<string, string | number>) {
    return this.api.get<{
      success: boolean;
      data: StockAdjustmentTicket[];
      total: number;
      summary?: { total: number; pending: number; inTransit: number; completed: number };
    }>('/inventory/adjustment-tickets', params);
  }

  getTicketById(id: string) {
    return this.api.get<{
      success: boolean;
      data: StockAdjustmentTicket;
    }>(`/inventory/adjustment-tickets/${id}`);
  }

  createTicket(body: {
    storeId: string;
    storeName?: string;
    targetStoreId?: string;
    targetStoreName?: string;
    type: 'goods_receipt' | 'spoilage_writeoff' | 'cycle_count' | 'boris_return' | 'store_transfer';
    items: Array<{
      productId: string;
      quantityDelta: number;
      unitPrice?: number;
      batchCode?: string;
      expDate?: string | null;
      reason?: string;
    }>;
    note?: string;
    supplierId?: string;
    supplierName?: string;
  }) {
    return this.api.post<{
      success: boolean;
      message: string;
      status: string;
      ticket: StockAdjustmentTicket;
    }>('/inventory/adjustment-tickets', body);
  }

  approveTicket(id: string) {
    return this.api.put<{
      success: boolean;
      message: string;
      data: StockAdjustmentTicket;
    }>(`/inventory/adjustment-tickets/${id}/approve`, {});
  }

  rejectTicket(id: string, reason: string = '') {
    return this.api.put<{
      success: boolean;
      message: string;
      data: StockAdjustmentTicket;
    }>(`/inventory/adjustment-tickets/${id}/reject`, { reason });
  }

  receiveTransfer(id: string) {
    return this.api.put<{
      success: boolean;
      message: string;
      data: StockAdjustmentTicket;
    }>(`/inventory/adjustment-tickets/${id}/receive-transfer`, {});
  }

  getSuppliers() {
    return this.api.get<{
      success: boolean;
      data: SupplierItem[];
    }>('/inventory/suppliers');
  }

  getSupplierDebts() {
    return this.api.get<{
      success: boolean;
      data: SupplierDebtItem[];
    }>('/inventory/supplier-debts');
  }

  recordSupplierPayment(payload: {
    supplierId?: string;
    ticketId?: string;
    amount: number;
    paymentMethod?: string;
    note?: string;
  }) {
    return this.api.post<{
      success: boolean;
      message: string;
    }>('/inventory/supplier-payments', payload);
  }

  getFefoAlerts() {
    return this.api.get<{
      success: boolean;
      count: number;
      data: Array<{
        storeId: string;
        storeName: string;
        productId: string;
        productName: string;
        productImage: string;
        category: string;
        unit: string;
        batchCode: string;
        expDate: string;
        daysLeft: number;
        quantity: number;
        costPrice: number;
        isExpired: boolean;
      }>;
    }>('/inventory/fefo-alerts');
  }

  getStoreConfig(storeId: string, productId: string) {
    return this.api.get<{
      success: boolean;
      data: StoreInventoryConfig & {
        stock?: number;
        productName?: string;
        priceNumber?: number;
      };
    }>('/inventory/store-config', { storeId, productId });
  }

  updateStoreConfig(body: {
    storeId: string;
    productId: string;
    safetyBuffer?: number;
    storePrice?: number | null;
    storeDiscountPrice?: number | null;
  }) {
    return this.api.put<{
      success: boolean;
      message: string;
      data: any;
    }>('/inventory/store-config', body);
  }

  getClearanceStatus(storeId?: string) {
    return this.api.get<{
      success: boolean;
      active: boolean;
      count: number;
      discountPercent: number;
      message: string;
    }>('/inventory/clearance-status', storeId ? { storeId } : undefined);
  }

  triggerClearance(discountPercent = 0.3, storeId?: string) {
    return this.api.post<{
      success: boolean;
      count: number;
      message: string;
    }>('/inventory/trigger-clearance', { discountPercent, targetStoreId: storeId });
  }

  resetClearance(storeId?: string) {
    return this.api.post<{
      success: boolean;
      message: string;
    }>('/inventory/reset-clearance', { targetStoreId: storeId });
  }
}
