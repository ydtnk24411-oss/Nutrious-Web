import { Injectable, signal, computed, inject } from '@angular/core';
import { ApiService } from './api.service';
import {
  ShippingApiService,
  WarehouseLocation,
  DEFAULT_WAREHOUSES,
  findNearestWarehouse,
} from './shipping-api.service';
import { XanhLaAddress, XanhLaUser, XanhLaCartItem } from '../models/xanh-la.models';

const SELECTED_STORE_KEY = 'xanhla_selected_store_id';
const STORE_PROMPTED_KEY = 'xanhla_store_prompted_once';

export interface PriceDiscrepancyItem {
  productId: string;
  productName: string;
  slug: string;
  image?: string;
  requestedQuantity: number;
  oldPrice: number;
  newPrice: number;
  priceDiff: number;
  isPriceChanged: boolean;
  oldStoreStock: number;
  newStoreStock: number;
  isOutOfStock: boolean;
}

export interface PriceDiscrepancyModalData {
  fromStore: WarehouseLocation;
  toStore: WarehouseLocation;
  userAddressLabel: string;
  discrepancies: PriceDiscrepancyItem[];
}

@Injectable({ providedIn: 'root' })
export class StoreLocationService {
  private api = inject(ApiService);
  private shippingApi = inject(ShippingApiService);

  private _warehouses = signal<WarehouseLocation[]>(DEFAULT_WAREHOUSES);
  readonly warehouses = this._warehouses.asReadonly();

  private _selectedStore = signal<WarehouseLocation>(this._loadInitialStore());
  readonly selectedStore = this._selectedStore.asReadonly();

  private _modalOpen = signal<boolean>(false);
  readonly modalOpen = this._modalOpen.asReadonly();

  // Bật thông báo chào mừng & chọn kho cho khách lần đầu vào website
  private _isWelcomePrompt = signal<boolean>(false);
  readonly isWelcomePrompt = this._isWelcomePrompt.asReadonly();

  // Modal cảnh báo minh bạch khi địa chỉ khách làm thay đổi chi nhánh & giá / tồn kho
  private _discrepancyData = signal<PriceDiscrepancyModalData | null>(null);
  readonly discrepancyData = this._discrepancyData.asReadonly();

  constructor() {
    this.refreshWarehouses();

    if (typeof window !== 'undefined') {
      try {
        const hasPrompted = localStorage.getItem(STORE_PROMPTED_KEY);
        const hasExplicitStore = localStorage.getItem(SELECTED_STORE_KEY);
        if (!hasPrompted && !hasExplicitStore) {
          // Bật thông báo chào đón khách chọn kho sau 600ms
          setTimeout(() => {
            this._isWelcomePrompt.set(true);
            this._modalOpen.set(true);
          }, 600);
        }
      } catch {}
    }
  }

  private _loadInitialStore(): WarehouseLocation {
    try {
      const savedId = localStorage.getItem(SELECTED_STORE_KEY);
      if (savedId) {
        const found = DEFAULT_WAREHOUSES.find((w) => w.id === savedId);
        if (found) return found;
      }
    } catch {}
    return DEFAULT_WAREHOUSES[0]; // Mặc định: Tổng kho Evergreen Mart Thủ Đức
  }

  refreshWarehouses(): void {
    this.api.get<{ success: boolean; data: WarehouseLocation[] }>('/shipping/warehouses').subscribe({
      next: (res) => {
        if (res.success && Array.isArray(res.data) && res.data.length > 0) {
          this._warehouses.set(res.data);
          const currentId = this._selectedStore().id;
          const updated = res.data.find((w) => w.id === currentId);
          if (updated) {
            this._selectedStore.set(updated);
          }
        }
      },
      error: () => {},
    });
  }

  openModal(): void {
    this._modalOpen.set(true);
  }

  closeModal(): void {
    try {
      localStorage.setItem(STORE_PROMPTED_KEY, 'true');
    } catch {}
    this._modalOpen.set(false);
    this._isWelcomePrompt.set(false);
  }

  selectStore(store: WarehouseLocation): void {
    this._selectedStore.set(store);
    try {
      localStorage.setItem(SELECTED_STORE_KEY, store.id || 'store-thuduc');
      localStorage.setItem(STORE_PROMPTED_KEY, 'true');
    } catch {}
    this._modalOpen.set(false);
    this._isWelcomePrompt.set(false);
    // Thông báo cho toàn bộ ứng dụng cập nhật lại dữ liệu theo kho mới
    window.dispatchEvent(new CustomEvent('xanhla:store_changed', { detail: store }));
  }

  /**
   * Định vị kho gần nhất bằng tọa độ GPS khách hàng
   */
  selectNearestByCoords(lat: number, lng: number): WarehouseLocation {
    const nearest = findNearestWarehouse(lat, lng, this._warehouses());
    this.selectStore(nearest);
    return nearest;
  }

  /**
   * Tự động lấy vị trí GPS từ trình duyệt
   */
  detectLocationAndSelectNearest(
    onSuccess?: (wh: WarehouseLocation) => void,
    onError?: (err: GeolocationPositionError | Error) => void
  ): void {
    this.shippingApi.getCurrentBrowserPosition(
      ({ lat, lng }) => {
        const wh = this.selectNearestByCoords(lat, lng);
        onSuccess?.(wh);
      },
      (err) => {
        onError?.(err);
      },
      4000
    );
  }

  /**
   * Tìm siêu thị phục vụ phù hợp với địa chỉ nhận hàng của người dùng
   */
  findNearestForAddress(addr: XanhLaAddress): WarehouseLocation {
    const list = this._warehouses();
    if (!list || list.length === 0) return this._selectedStore();

    // 1. Nếu có tọa độ GPS chính xác
    if (typeof addr.lat === 'number' && typeof addr.lng === 'number' && addr.lat > 0 && addr.lng > 0) {
      return findNearestWarehouse(addr.lat, addr.lng, list);
    }

    // 2. So khớp theo chuỗi quận / huyện / tỉnh thành
    const fullText = `${addr.street || ''} ${addr.ward || ''} ${addr.address || ''} ${addr.city || ''} ${addr.province || ''}`.toLowerCase();

    // Ưu tiên khớp theo quận/huyện
    const districtKeywords: Record<string, string> = {
      'thủ đức': 'store-thuduc',
      'thu duc': 'store-thuduc',
      'quận 1': 'store-q1',
      'quan 1': 'store-q1',
      'bình thạnh': 'store-binhthanh',
      'binh thanh': 'store-binhthanh',
      'gò vấp': 'store-govap',
      'go vap': 'store-govap',
      'tân bình': 'store-tanbinh',
      'tan binh': 'store-tanbinh',
      'bình tân': 'store-binhtan',
      'binh tan': 'store-binhtan',
      'quận 7': 'store-q7',
      'quan 7': 'store-q7',
      'quận 8': 'store-q8',
      'quan 8': 'store-q8',
      'quận 12': 'store-q12',
      'quan 12': 'store-q12',
      'hóc môn': 'store-hocmon',
      'hoc mon': 'store-hocmon',
      'bình chánh': 'store-binhchanh',
      'binh chanh': 'store-binhchanh',
      'dĩ an': 'store-dian',
      'di an': 'store-dian',
      'bình dương': 'store-dian',
      'binh duong': 'store-dian',
    };

    for (const [kw, storeId] of Object.entries(districtKeywords)) {
      if (fullText.includes(kw)) {
        const found = list.find((w) => w.id === storeId);
        if (found) return found;
      }
    }

    return this._selectedStore();
  }

  /**
   * Kiểm tra địa chỉ mặc định sau khi đăng nhập và phát hiện chênh lệch giá / tồn kho minh bạch
   */
  checkUserDefaultAddressOnLogin(
    user: XanhLaUser,
    cartItems: XanhLaCartItem[],
    onDiscrepancyResolved?: () => void
  ): void {
    if (!user || !Array.isArray(user.addresses) || user.addresses.length === 0) {
      // Người dùng chưa có sổ địa chỉ: giữ nguyên siêu thị hiện tại
      return;
    }

    const defaultAddr = user.addresses.find((a) => a.isDefault) || user.addresses[0];
    if (!defaultAddr) return;

    const targetStore = this.findNearestForAddress(defaultAddr);
    const currentStore = this._selectedStore();

    if (targetStore.id === currentStore.id) {
      // Đang phục vụ đúng siêu thị gần nhà nhất
      return;
    }

    // Nếu giỏ hàng đang trống: tự động đổi siêu thị mượt mà không cần xác nhận
    if (!cartItems || cartItems.length === 0) {
      this.selectStore(targetStore);
      return;
    }

    // Nếu giỏ hàng đã có sản phẩm: Kiểm tra xem có sản phẩm nào bị lệch giá hoặc hết hàng ở siêu thị mới không
    const payloadItems = cartItems.map((item) => ({
      productId: item.product.id || (item.product as any)._id,
      slug: item.product.slug,
      quantity: item.quantity,
      priceNumber: item.product.priceNumber,
    }));

    this.api
      .post<{
        success: boolean;
        hasDiscrepancy: boolean;
        fromStore: WarehouseLocation;
        toStore: WarehouseLocation;
        discrepancies: PriceDiscrepancyItem[];
      }>('/products/compare-store-prices', {
        fromStoreId: currentStore.id,
        toStoreId: targetStore.id,
        items: payloadItems,
      })
      .subscribe({
        next: (res) => {
          if (res.success && res.hasDiscrepancy && res.discrepancies.length > 0) {
            // Mở modal cảnh báo minh bạch cho người dùng lựa chọn
            this._discrepancyData.set({
              fromStore: currentStore,
              toStore: targetStore,
              userAddressLabel: `${defaultAddr.address}, ${defaultAddr.ward || ''} ${defaultAddr.city || ''}`.replace(/\s+/g, ' ').trim(),
              discrepancies: res.discrepancies,
            });
          } else {
            // Không có chênh lệch giá hoặc thiếu hàng: Tự động chuyển siêu thị phục vụ
            this.selectStore(targetStore);
            onDiscrepancyResolved?.();
          }
        },
        error: () => {
          // Fallback an toàn: giữ nguyên siêu thị hiện tại
        },
      });
  }

  closeDiscrepancyModal(): void {
    this._discrepancyData.set(null);
  }

  /**
   * Lựa chọn 1: Cập nhật sang siêu thị mới (giao về nhà theo giá / tồn kho mới)
   */
  confirmSwitchToNewStore(): void {
    const data = this._discrepancyData();
    if (data) {
      this.selectStore(data.toStore);
      this._discrepancyData.set(null);
    }
  }

  /**
   * Lựa chọn 2: Giữ nguyên siêu thị cũ và nhận tại cửa hàng (BOPIS) để giữ giá ưu đãi
   */
  confirmKeepOldStoreForPickup(): void {
    this._discrepancyData.set(null);
  }
}
