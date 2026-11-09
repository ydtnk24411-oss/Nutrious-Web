import { Component, signal, inject, computed, effect, OnInit, OnDestroy, HostListener } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as L from 'leaflet';
import { ShellComponent } from '../../components/shell/shell.component';
import { CartService, formatPrice, getCartItemKey } from '../../shared/services/cart.service';
import { OrderApiService } from '../../shared/services/order-api.service';
import { VoucherService } from '../../shared/services/voucher.service';
import { Voucher, XanhLaCartItem, EvaluatedCartItemPricing, XanhLaAddress } from '../../shared/models/xanh-la.models';
import { LocationService, ProvinceItem, WardItem } from '../../shared/services/location.service';
import {
  ShippingApiService,
  ShippingCalculationResult,
  NominatimPlace,
  WarehouseLocation,
  DEFAULT_WAREHOUSES,
  findNearestWarehouse,
} from '../../shared/services/shipping-api.service';

export const PROVINCE_CENTERS: Record<string, { lat: number; lng: number }> = {
  'Hồ Chí Minh': { lat: 10.8231, lng: 106.6297 },
  'Hà Nội': { lat: 21.0285, lng: 105.8542 },
  'Đà Nẵng': { lat: 16.0544, lng: 108.2022 },
  'Bình Dương': { lat: 10.9804, lng: 106.6519 },
  'Đồng Nai': { lat: 10.9574, lng: 106.8427 },
  'Cần Thơ': { lat: 10.0452, lng: 105.7469 },
  'Hải Phòng': { lat: 20.8449, lng: 106.6881 },
  'Bà Rịa': { lat: 10.4114, lng: 107.1362 },
  'Long An': { lat: 10.5362, lng: 106.4116 },
  'Tây Ninh': { lat: 11.3347, lng: 106.0989 },
  'Tiền Giang': { lat: 10.4493, lng: 106.3421 },
  'Bến Tre': { lat: 10.2433, lng: 106.3753 },
  'Vĩnh Long': { lat: 10.2537, lng: 105.9722 },
  'Đồng Tháp': { lat: 10.4576, lng: 105.6329 },
  'An Giang': { lat: 10.3888, lng: 105.4359 },
  'Kiên Giang': { lat: 9.9482, lng: 105.1492 },
  'Hậu Giang': { lat: 9.7844, lng: 105.4701 },
  'Sóc Trăng': { lat: 9.6033, lng: 105.9745 },
  'Bạc Liêu': { lat: 9.2941, lng: 105.7278 },
  'Cà Mau': { lat: 9.1769, lng: 105.1524 },
  'Trà Vinh': { lat: 9.9347, lng: 106.3455 },
  'Lâm Đồng': { lat: 11.9404, lng: 108.4583 },
  'Khánh Hòa': { lat: 12.2388, lng: 109.1967 },
  'Đắk Lắk': { lat: 12.6667, lng: 108.0500 },
  'Đắk Nông': { lat: 12.0044, lng: 107.6875 },
  'Gia Lai': { lat: 13.9833, lng: 108.0000 },
  'Kon Tum': { lat: 14.3500, lng: 108.0000 },
  'Bình Thuận': { lat: 10.9333, lng: 108.1000 },
  'Ninh Thuận': { lat: 11.5667, lng: 108.9833 },
  'Bình Phước': { lat: 11.7511, lng: 106.9066 },
  'Thừa Thiên Huế': { lat: 16.4637, lng: 107.5909 },
  'Quảng Nam': { lat: 15.5667, lng: 108.2000 },
  'Quảng Ngãi': { lat: 15.1167, lng: 108.8000 },
  'Bình Định': { lat: 13.7833, lng: 109.2167 },
  'Phú Yên': { lat: 13.0833, lng: 109.3000 },
  'Nghệ An': { lat: 18.6667, lng: 105.6667 },
  'Thanh Hóa': { lat: 19.8000, lng: 105.7833 },
  'Hà Tĩnh': { lat: 18.3333, lng: 105.9000 },
  'Quảng Bình': { lat: 17.4833, lng: 106.6000 },
  'Quảng Trị': { lat: 16.8167, lng: 107.1000 },
};

export interface CheckoutVoucherOption {
  voucher: Voucher;
  inWallet: boolean;
  isEligible: boolean;
  estimatedDiscount: number;
}

export interface NonRefundableItemSummary {
  name: string;
  categoryName: string;
  isCombo?: boolean;
}

export type StoreBranch = WarehouseLocation & { id: string };
export const STORE_BRANCHES: StoreBranch[] = DEFAULT_WAREHOUSES as StoreBranch[];

export interface TimeSlotOption {
  label: string;
  originalPrice: number;
  isFreeship: boolean;
  priceText: string;
}

export const DELIVERY_TIME_SLOTS: TimeSlotOption[] = [
  { label: 'Từ 08h00 - 12h00', originalPrice: 14000, isFreeship: true, priceText: 'Freeship' },
  { label: 'Từ 12h00 - 16h00', originalPrice: 14000, isFreeship: true, priceText: 'Freeship' },
  { label: 'Từ 13h00 - 14h00', originalPrice: 20000, isFreeship: true, priceText: 'Freeship' },
  { label: 'Từ 14h00 - 15h00', originalPrice: 20000, isFreeship: true, priceText: 'Freeship' },
  { label: 'Từ 15h00 - 16h00', originalPrice: 20000, isFreeship: true, priceText: 'Freeship' },
  { label: 'Từ 16h00 - 17h00', originalPrice: 20000, isFreeship: true, priceText: 'Freeship' },
  { label: 'Từ 17h00 - 18h00', originalPrice: 20000, isFreeship: true, priceText: 'Freeship' },
  { label: 'Từ 18h00 - 20h00', originalPrice: 20000, isFreeship: true, priceText: 'Freeship' },
];

// Nhận diện sản phẩm tươi sống thuộc 4 nhóm: Rau củ, Trái cây, Thịt, Cá & Hải sản
export function isFreshPerishableProduct(p: any): { isFresh: boolean; categoryName: string } {
  if (!p) return { isFresh: false, categoryName: '' };
  const cat = (p.category || '').toLowerCase();
  const catVi = (p.categoryVi || '').toLowerCase();
  const name = (p.name || '').toLowerCase();
  const combined = `${cat} ${catVi} ${name}`;

  // Loại trừ nhóm đồ uống, bánh kẹo, gia vị & đồ khô, sữa
  const excluded = [
    'beverages', 'thức uống', 'nước ép',
    'bakery', 'bánh mỳ', 'bánh ngọt',
    'pantry', 'gia vị', 'đồ khô', 'hạt & ngũ cốc',
    'dairy'
  ];
  if (excluded.some(ex => cat.includes(ex) || catVi.includes(ex))) {
    return { isFresh: false, categoryName: '' };
  }

  // 1. Rau củ
  if (/rau\s*củ|rau\s*ăn|rau\s*gia\s*vị|nấm\s*tươi|củ\s*quả|vegetable/i.test(combined)) {
    return { isFresh: true, categoryName: 'Rau củ tươi' };
  }
  // 2. Trái cây
  if (/trái\s*cây|hoa\s*quả|fruit/i.test(combined)) {
    return { isFresh: true, categoryName: 'Trái cây tươi' };
  }
  // 3. Thịt
  if (/thịt|meat|thịt\s*bò|thịt\s*heo|thịt\s*gà|gia\s*cầm/i.test(combined)) {
    return { isFresh: true, categoryName: 'Thịt tươi sống' };
  }
  // 4. Cá & hải sản
  if (/cá\s*&?\s*hải\s*sản|hải\s*sản|seafood|thủy\s*hải\s*sản/i.test(combined)) {
    return { isFresh: true, categoryName: 'Cá & hải sản tươi' };
  }

  return { isFresh: false, categoryName: '' };
}

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, FormsModule, ShellComponent, RouterLink],
  templateUrl: './checkout.component.html',
  styleUrl: './checkout.component.css',
})
export class CheckoutComponent implements OnInit, OnDestroy {
  protected cart     = inject(CartService);
  private orderApi   = inject(OrderApiService);
  private router     = inject(Router);
  private route      = inject(ActivatedRoute);
  protected voucher  = inject(VoucherService);
  private locationService = inject(LocationService);
  private shippingApi = inject(ShippingApiService);
  protected formatPrice = formatPrice;

  protected completed      = signal(false);
  protected orderCode      = signal('');
  protected submitting     = signal(false);
  protected errorMsg       = signal('');
  protected shippingMethod = signal<'pickup' | 'delivery'>('delivery');
  protected paymentMethod  = signal<'cod' | 'bank_transfer'>('cod');

  // VietQR & Chuyển khoản ngân hàng
  protected qrUrl        = signal<string | null>(null);
  protected createdTotal = signal<number>(0);
  protected bankInfo     = signal<{ bankId: string; accountNo: string; accountName: string } | null>(null);
  protected copiedField  = signal<string | null>(null);

  // Voucher
  protected voucherCode = signal('');
  protected selectedVoucher = signal<any>(null);
  protected voucherDiscount = signal(0);
  protected voucherMessage = signal('');
  protected showVoucherPicker = signal(false);
  private pendingQueryVoucher = signal('');

  // Modal Địa chỉ nhận hàng (Bách Hoá XANH style)
  protected showAddressModal = signal(false);
  protected addressModalView = signal<'form' | 'province' | 'ward' | 'map'>('form');

  // Danh sách Tỉnh/Thành & Phường/Xã từ Open API
  protected provincesList = signal<ProvinceItem[]>([]);
  protected provinceSearch = signal('');
  protected showOldProvinceNames = signal(false);
  protected selectedProvince = signal<ProvinceItem | null>(null);

  protected wardsList = signal<WardItem[]>([]);
  protected wardSearch = signal('');
  protected selectedWard = signal<WardItem | null>(null);

  protected streetInput = signal('');

  // Gợi ý địa chỉ tự động (Auto-suggest)
  protected streetSuggestions = signal<NominatimPlace[]>([]);
  protected isSearchingSuggestions = signal(false);
  protected showSuggestionsDropdown = signal(false);
  protected selectedSuggestion = signal<NominatimPlace | null>(null);
  private searchStreetTimer: any = null;

  // Người nhận
  protected otherReceiverChecked = signal(false);
  protected otherReceiverName = signal('');
  protected otherReceiverPhone = signal('');

  // Trạng thái GPS & Xác nhận vị trí trên bản đồ
  protected isLocating = signal(false);
  protected locationError = signal('');
  protected isGeocoding = signal(false);
  protected mapConfirmLat = signal<number>(10.8703);
  protected mapConfirmLng = signal<number>(106.7782);
  protected userEnteredAddress = signal<string>('');
  protected referenceAddress = signal<string>('');
  protected wardCenterCoords = signal<{ lat: number; lng: number } | null>(null);
  protected matchQuality = signal<'exact' | 'street_match' | 'approximate' | 'manual' | 'gps'>('exact');
  protected isMapResolving = signal(false);

  private confirmMap: L.Map | null = null;
  private confirmMarker: L.Marker | null = null;

  // Lọc Tỉnh/Thành theo tìm kiếm
  readonly filteredProvinces = computed(() => {
    const q = this.provinceSearch().trim().toLowerCase();
    const list = this.provincesList();
    if (!q) return list;
    return list.filter(p => p.name.toLowerCase().includes(q) || (p.codename && p.codename.includes(q)));
  });

  // Lọc Phường/Xã theo tìm kiếm
  readonly filteredWards = computed(() => {
    const q = this.wardSearch().trim().toLowerCase();
    const list = this.wardsList();
    if (!q) return list;
    return list.filter(w => w.name.toLowerCase().includes(q) || (w.codename && w.codename.includes(q)));
  });

  // Người nhận hiện tại
  readonly currentReceiverName = computed(() => {
    if (this.otherReceiverChecked() && this.otherReceiverName().trim()) {
      return this.otherReceiverName().trim();
    }
    return this.guestName() || this.cart.currentUser()?.name || 'Khách hàng';
  });

  readonly currentReceiverPhone = computed(() => {
    if (this.otherReceiverChecked() && this.otherReceiverPhone().trim()) {
      return this.otherReceiverPhone().trim();
    }
    return this.guestPhone() || this.cart.currentUser()?.phone || '';
  });

  readonly receiverSummary = computed(() => {
    const name = this.currentReceiverName();
    const phone = this.currentReceiverPhone();
    if (name && phone) return `${name}, ${phone}`;
    if (name) return name;
    if (phone) return phone;
    return 'Chưa có thông tin người nhận';
  });

  readonly canProceedToMap = computed(() => {
    const hasProvince = !!this.selectedProvince();
    const hasWard = !!this.selectedWard();
    const hasStreet = !!this.streetInput().trim();
    if (!hasProvince || !hasWard || !hasStreet) return false;
    if (this.otherReceiverChecked()) {
      if (!this.otherReceiverName().trim() || !this.otherReceiverPhone().trim()) return false;
    }
    return true;
  });

  // Chỉ thanh toán các món được chọn trong giỏ hàng
  readonly checkoutItems = computed(() => {
    return this.cart.selectedItems();
  });

  readonly checkoutSubtotal = computed(() => {
    return this.cart.selectedSubtotal();
  });

  readonly originalSubtotal = computed(() => {
    return this.cart.selectedOriginalSubtotal();
  });

  readonly comboDiscount = computed(() => {
    return this.cart.selectedComboDiscount();
  });

  readonly addonDiscount = computed(() => {
    return this.cart.selectedAddonDiscount();
  });

  // Quy chế Hàng tươi sống không hỗ trợ Hủy / Đổi / Trả (Rau củ, Trái cây, Thịt, Cá & Hải sản)
  protected nonRefundableConfirmed = signal(false);
  protected showNonRefundableModal = signal(false);
  protected modalPolicyChecked = signal(false);

  readonly nonRefundablePolicy = computed<{
    hasNonRefundableItems: boolean;
    items: NonRefundableItemSummary[];
  }>(() => {
    const items = this.checkoutItems();
    const freshList: NonRefundableItemSummary[] = [];

    for (const it of items) {
      const prod = it.product as any;
      if (!prod) continue;

      const isCombo = Boolean(prod.isCombo || it.isCombo || it.itemType === 'combo');

      if (isCombo && Array.isArray(prod.comboItems) && prod.comboItems.length > 0) {
        const comboCheck = isFreshPerishableProduct(prod);
        let comboIsFresh = comboCheck.isFresh;
        const subNames: string[] = [];
        for (const ci of prod.comboItems) {
          const subP = ci.product || ci;
          const subCheck = isFreshPerishableProduct(subP);
          if (subCheck.isFresh) {
            comboIsFresh = true;
            subNames.push(subP.name || ci.name || 'Thành phần tươi sống');
          }
        }
        if (comboIsFresh) {
          freshList.push({
            name: subNames.length > 0 ? `${prod.name} (thành phần: ${subNames.join(', ')})` : prod.name,
            categoryName: comboCheck.categoryName || 'Combo thực phẩm tươi sống',
            isCombo: true,
          });
        }
      } else {
        const check = isFreshPerishableProduct(prod);
        if (check.isFresh) {
          freshList.push({
            name: prod.name,
            categoryName: check.categoryName,
            isCombo: isCombo,
          });
        }
      }
    }

    return {
      hasNonRefundableItems: freshList.length > 0,
      items: freshList,
    };
  });

  protected itemKey = getCartItemKey;

  itemPricing(item: XanhLaCartItem): EvaluatedCartItemPricing {
    return this.cart.getItemPricing(item, 'selected');
  }

  /** Danh sách ưu đãi để chọn trực tiếp khi thanh toán (gồm Ví voucher + ưu đãi công khai từ MongoDB). */
  readonly checkoutVoucherOptions = computed<CheckoutVoucherOption[]>(() => {
    const sub = this.checkoutSubtotal();
    const walletSet = new Set(this.voucher.availableVouchers().map(uv => uv.voucher.code.toUpperCase()));
    const byCode = new Map<string, Voucher>();

    for (const uv of this.voucher.availableVouchers()) {
      byCode.set(uv.voucher.code.toUpperCase(), uv.voucher);
    }
    for (const pub of this.voucher.publicVouchers()) {
      const k = pub.code.toUpperCase();
      if (!byCode.has(k)) byCode.set(k, pub);
    }

    return Array.from(byCode.values())
      .map((v) => {
        const minVal = v.minValue || 0;
        const isEligible = sub >= minVal && sub > 0;
        let disc = v.type === 'percentage' ? Math.floor((sub * v.value) / 100) : v.value;
        if (v.type === 'percentage' && v.maxValue) {
          disc = Math.min(disc, v.maxValue);
        }
        disc = isEligible ? Math.max(0, Math.min(disc, sub)) : 0;
        return {
          voucher: v,
          inWallet: walletSet.has(v.code.toUpperCase()),
          isEligible,
          estimatedDiscount: disc,
        };
      })
      .sort((a, b) => {
        if (a.isEligible !== b.isEligible) return a.isEligible ? -1 : 1;
        if (a.inWallet !== b.inWallet) return a.inWallet ? -1 : 1;
        return b.estimatedDiscount - a.estimatedDiscount;
      });
  });

  // Loyalty points estimate
  readonly estimatedPoints = computed(() => {
    return Math.floor(this.checkoutSubtotal() / 1000); // 1 điểm cho mỗi 1000đ
  });

  // Nhận tại cửa hàng (Danh sách cửa hàng / chi nhánh)
  readonly storeBranches = STORE_BRANCHES;
  protected selectedPickupStoreId = signal<string>('store-thuduc');
  readonly selectedPickupStore = computed(() => {
    return this.storeBranches.find(s => s.id === this.selectedPickupStoreId()) || this.storeBranches[0];
  });

  // Kho / Cửa hàng giao từ tự động lấy điểm gần nhất theo địa chỉ nhận hàng
  readonly nearestWarehouse = computed<WarehouseLocation>(() => {
    // 1. Ưu tiên kho đã được API tính toán phí ship xác nhận (theo tọa độ OSRM)
    const calculatedWh = this.shippingCalculation()?.warehouse;
    if (calculatedWh && calculatedWh.name && calculatedWh.address) {
      return calculatedWh;
    }

    // 2. Nếu đã có tọa độ ghim trên bản đồ xác nhận
    const lat = this.mapConfirmLat();
    const lng = this.mapConfirmLng();
    if (lat && lng) {
      return findNearestWarehouse(lat, lng, DEFAULT_WAREHOUSES);
    }

    // 3. Nếu người dùng có tọa độ từ sổ địa chỉ đã lưu
    const defAddr = this._defaultAddressObj();
    if (defAddr?.lat && defAddr?.lng) {
      return findNearestWarehouse(defAddr.lat, defAddr.lng, DEFAULT_WAREHOUSES);
    }

    // 4. Nếu người dùng đã chọn Tỉnh/Thành phố
    const prov = this.selectedProvince();
    if (prov?.name) {
      const pName = prov.name.toLowerCase();
      const match = DEFAULT_WAREHOUSES.find(w =>
        w.province && (w.province.toLowerCase().includes(pName) || pName.includes(w.province.toLowerCase()))
      );
      if (match) return match;

      const center = PROVINCE_CENTERS[prov.name] || this.getProvinceBiasCoords();
      if (center) {
        return findNearestWarehouse(center.lat, center.lng, DEFAULT_WAREHOUSES);
      }
    }

    // 5. Mặc định: Tổng kho Evergreen Mart Thủ Đức (Trụ sở chính)
    return DEFAULT_WAREHOUSES[0];
  });

  // Chuỗi hiển thị "Giao từ" (ví dụ: Kho Evergreen Mart Nha Trang (Số 82 Lê Hồng Phong...))
  readonly nearestWarehouseDisplay = computed<string>(() => {
    const wh = this.nearestWarehouse();
    if (!wh) return 'Tổng kho Evergreen Mart Thủ Đức (Khu phố 6, Linh Trung, TP. Thủ Đức, TP.HCM)';
    return `${wh.name} (${wh.address})`;
  });

  // Chọn thời gian giao hàng (Giao tận nơi)
  readonly deliveryTimeSlots = DELIVERY_TIME_SLOTS;
  protected deliveryTimeExpanded = signal<boolean>(true);
  protected selectedDeliveryType = signal<'instant' | 'standard' | 'timeslot'>('timeslot');
  protected selectedDeliveryDay = signal<'today' | 'tomorrow'>('today');
  protected selectedTimeSlot = signal<string>('Từ 14h00 - 15h00');

  // Tính ngày động Hôm nay / Ngày mai
  readonly deliveryDates = computed(() => {
    const now = new Date();
    const d = String(now.getDate()).padStart(2, '0');
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const todayStr = `${d}/${m}`;

    const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const td = String(tomorrow.getDate()).padStart(2, '0');
    const tm = String(tomorrow.getMonth() + 1).padStart(2, '0');
    const tomorrowStr = `${td}/${tm}`;

    return { todayStr, tomorrowStr };
  });

  readonly selectedDeliveryTimeString = computed(() => {
    if (this.shippingMethod() === 'pickup') {
      const store = this.selectedPickupStore();
      return `Đến lấy trực tiếp: ${store.name}`;
    }
    const type = this.selectedDeliveryType();
    if (type === 'instant') {
      return 'Giao ngay 🛵 (30 - 45 phút)';
    }
    if (type === 'standard') {
      return 'Giao hàng tiết kiệm (trong 24h)';
    }
    const dates = this.deliveryDates();
    const dayLabel = this.selectedDeliveryDay() === 'today'
      ? `Hôm nay (${dates.todayStr})`
      : `Ngày mai (${dates.tomorrowStr})`;
    return `${dayLabel}: ${this.selectedTimeSlot()}`;
  });

  // Vận chuyển & Bản đồ định vị
  protected shippingCoordinates = signal<{ lat: number; lng: number } | null>(null);
  protected shippingCalculation = signal<ShippingCalculationResult | null>(null);
  protected isOutOfRange = signal(false);
  protected outOfRangeMessage = signal('');

  // Phí ship thực tế (lấy từ kết quả tính toán backend theo khoảng cách OSRM hoặc loại giao hàng)
  readonly shippingDistanceKm = computed(() => {
    return this.shippingCalculation()?.distanceKm ?? 0;
  });

  readonly estimatedDeliveryTime = computed(() => {
    return this.selectedDeliveryTimeString();
  });

  readonly shippingUnsupported = computed(() => {
    return this.shippingMethod() === 'delivery' && (this.isOutOfRange() || (this.shippingCalculation() !== null && this.shippingCalculation()?.supported === false));
  });

  readonly shippingFee = computed(() => {
    if (this.shippingMethod() === 'pickup') return 0;
    // Giao hàng tiết kiệm hoặc Khung giờ nhận hàng -> Freeship 0đ
    if (this.selectedDeliveryType() === 'standard' || this.selectedDeliveryType() === 'timeslot') {
      return 0;
    }
    // Giao ngay 🛵 -> Phí 20.000đ (hoặc theo OSRM nếu cao hơn)
    const backendFee = this.shippingCalculation()?.finalFee ?? 20000;
    return Math.max(20000, backendFee);
  });

  readonly shippingDiscount = computed(() => {
    if (this.shippingMethod() === 'pickup') return 0;
    if (this.selectedDeliveryType() === 'standard' || this.selectedDeliveryType() === 'timeslot') {
      const origFee = this.shippingCalculation()?.finalFee ?? 20000;
      return Math.max(10000, origFee);
    }
    return this.shippingCalculation()?.discount ?? 0;
  });

  // Total sau giảm giá voucher + phí vận chuyển thực tế
  readonly finalTotal = computed(() => {
    return Math.max(0, this.checkoutSubtotal() - this.voucherDiscount() + this.shippingFee());
  });

  // form fields
  protected guestName    = signal(this.cart.currentUser()?.name  ?? '');
  protected guestPhone   = signal(this.cart.currentUser()?.phone ?? '');
  protected guestEmail   = signal(this.cart.currentUser()?.email ?? '');
  protected shippingAddr = signal(this._defaultAddress());

  constructor() {
    effect(() => {
      const code = this.pendingQueryVoucher();
      const subtotal = this.checkoutSubtotal();
      if (code && subtotal > 0) {
        this.pendingQueryVoucher.set('');
        this.applyVoucher();
      }
    });

    effect(() => {
      const u = this.cart.currentUser();
      if (u) {
        if (!this.guestName()) this.guestName.set(u.name || '');
        if (!this.guestEmail()) this.guestEmail.set(u.email || '');
        if (!this.guestPhone()) this.guestPhone.set(u.phone || '');
        const def = this._defaultAddressObj();
        if (def) {
          if (!this.shippingAddr()) this.shippingAddr.set([def.address, def.city].filter(Boolean).join(', '));
          if (!this.shippingCoordinates() && def.lat && def.lng) {
            this.shippingCoordinates.set({ lat: def.lat, lng: def.lng });
            this.recalculateShipping(def.lat, def.lng);
          }
        }
      }
    });
  }

  ngOnInit(): void {
    this.voucher.loadPublic();
    this.voucher.refreshMine();
    const qCode = this.route.snapshot.queryParamMap.get('voucher');
    if (qCode) {
      const code = qCode.trim().toUpperCase();
      this.voucherCode.set(code);
      this.pendingQueryVoucher.set(code);
    }

    // Nếu người dùng đã có tọa độ giao hàng lưu trước đó, tính toán phí ship ban đầu
    const def = this._defaultAddressObj();
    if (def && def.lat && def.lng) {
      this.shippingCoordinates.set({ lat: def.lat, lng: def.lng });
      this.recalculateShipping(def.lat, def.lng);
    }
  }

  ngOnDestroy(): void {
    if (this.searchStreetTimer) clearTimeout(this.searchStreetTimer);
    this.destroyConfirmMap();
  }

  /** Lấy thông tin đối tượng địa chỉ mặc định của người dùng */
  private _defaultAddressObj(): XanhLaAddress | null {
    const addrs = this.cart.currentUser()?.addresses ?? [];
    return addrs.find((x) => x.isDefault) ?? addrs[0] ?? null;
  }

  /** Chuỗi địa chỉ mặc định của tài khoản đang đăng nhập */
  private _defaultAddress(): string {
    const a = this._defaultAddressObj();
    return a ? [a.address, a.city].filter(Boolean).join(', ') : '';
  }

  onSelectVoucherDropdown(code: string): void {
    if (!code) {
      this.removeVoucher();
      return;
    }
    this.voucherCode.set(code);
    this.applyVoucher();
  }

  selectOfferCode(code: string): void {
    this.voucherCode.set(code);
    this.applyVoucher();
  }

  applyVoucher(): void {
    const code = this.voucherCode().trim().toUpperCase();
    if (!code) {
      this.voucherMessage.set('Vui lòng nhập hoặc chọn mã voucher');
      return;
    }
    this.voucherCode.set(code);

    this.voucher.validateVoucher(code, this.checkoutSubtotal()).subscribe((result) => {
      if (result.valid) {
        this.selectedVoucher.set({ code, discount: result.discount });
        this.voucherDiscount.set(result.discount);
        this.voucherMessage.set(`Đã áp dụng mã ${code}: Giảm ${formatPrice(result.discount)}`);
      } else {
        this.selectedVoucher.set(null);
        this.voucherDiscount.set(0);
        this.voucherMessage.set(result.message || 'Mã voucher không hợp lệ');
      }
    });
  }

  removeVoucher(): void {
    this.selectedVoucher.set(null);
    this.voucherDiscount.set(0);
    this.voucherCode.set('');
    this.voucherMessage.set('');
  }

  // ── Mở / Đóng modal địa chỉ Bách Hoá XANH ────────────────────────
  openAddressModal(): void {
    this.showAddressModal.set(true);
    this.addressModalView.set('form');
    this.locationError.set('');

    if (this.shippingAddr()) {
      this.userEnteredAddress.set(this.shippingAddr());
    }
    if (this.shippingCoordinates()) {
      this.mapConfirmLat.set(this.shippingCoordinates()!.lat);
      this.mapConfirmLng.set(this.shippingCoordinates()!.lng);
    }

    if (this.provincesList().length === 0) {
      this.loadProvinces();
    }
  }

  closeAddressModal(): void {
    this.showAddressModal.set(false);
    this.addressModalView.set('form');
    this.showSuggestionsDropdown.set(false);
    this.streetSuggestions.set([]);
    this.destroyConfirmMap();
  }

  loadProvinces(): void {
    this.locationService.getProvinces().subscribe({
      next: (data) => {
        this.provincesList.set(data);
        if (!this.selectedProvince()) {
          const hcm = data.find(p => p.name.includes('Hồ Chí Minh') || p.code === 79);
          if (hcm) {
            this.selectedProvince.set(hcm);
            this.loadWards(hcm.code);
          }
        }
      },
      error: (err) => console.error('Lỗi tải Tỉnh/Thành phố:', err),
    });
  }

  loadWards(provinceCode: number): void {
    this.locationService.getWards(provinceCode).subscribe({
      next: (data) => {
        this.wardsList.set(data);
      },
      error: (err) => console.error('Lỗi tải Phường/Xã:', err),
    });
  }

  openProvincePicker(): void {
    this.provinceSearch.set('');
    this.addressModalView.set('province');
  }

  selectProvince(p: ProvinceItem): void {
    this.selectedProvince.set(p);
    this.selectedWard.set(null);
    this.wardCenterCoords.set(null);
    this.streetSuggestions.set([]);
    this.showSuggestionsDropdown.set(false);
    this.selectedSuggestion.set(null);
    this.loadWards(p.code);
    this.addressModalView.set('form');
  }

  openWardPicker(): void {
    if (!this.selectedProvince()) return;
    this.wardSearch.set('');
    this.addressModalView.set('ward');
  }

  selectWard(w: WardItem): void {
    this.selectedWard.set(w);
    this.streetSuggestions.set([]);
    this.showSuggestionsDropdown.set(false);
    this.selectedSuggestion.set(null);
    this.addressModalView.set('form');
    this.resolveWardCenter(w);
  }

  private resolveWardCenter(w: WardItem): void {
    const prov = this.selectedProvince();
    const bias = this.getProvinceBiasCoords();
    const provName = prov?.name || '';
    const query = `${w.name}, ${provName}, Việt Nam`;

    this.shippingApi.searchAddressNominatim(query, bias.lat, bias.lng).subscribe({
      next: (places) => {
        const match = places.find(p => this.isProvinceMatch(p, provName));
        if (match) {
          this.wardCenterCoords.set({ lat: parseFloat(match.lat), lng: parseFloat(match.lon) });
        } else if (places.length > 0) {
          this.wardCenterCoords.set({ lat: parseFloat(places[0].lat), lng: parseFloat(places[0].lon) });
        } else {
          this.wardCenterCoords.set(bias);
        }
      },
      error: () => this.wardCenterCoords.set(bias)
    });
  }

  backToForm(): void {
    this.addressModalView.set('form');
    this.destroyConfirmMap();
  }

  // ── Lấy vị trí GPS hiện tại (chỉ kích hoạt khi người dùng nhấn nút) ───
  getCurrentLocation(): void {
    if (!navigator.geolocation) {
      this.locationError.set('Trình duyệt của bạn không hỗ trợ định vị GPS.');
      return;
    }

    this.isLocating.set(true);
    this.locationError.set('');

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        this.mapConfirmLat.set(lat);
        this.mapConfirmLng.set(lng);

        this.shippingApi.reverseGeocodeNominatim(lat, lng).subscribe({
          next: (resolved) => {
            this.isLocating.set(false);
            const addressString = resolved || `Vị trí tọa độ (${lat.toFixed(5)}, ${lng.toFixed(5)})`;
            this.userEnteredAddress.set(addressString);
            this.referenceAddress.set(addressString);
            this.matchQuality.set('gps');
            this.addressModalView.set('map');
            this.initConfirmMap();
          },
          error: () => {
            this.isLocating.set(false);
            const addressString = `Vị trí tọa độ (${lat.toFixed(5)}, ${lng.toFixed(5)})`;
            this.userEnteredAddress.set(addressString);
            this.referenceAddress.set(addressString);
            this.matchQuality.set('gps');
            this.addressModalView.set('map');
            this.initConfirmMap();
          }
        });
      },
      (err) => {
        this.isLocating.set(false);
        let msg = 'Không thể lấy vị trí hiện tại.';
        if (err.code === 1) {
          msg = 'Bạn đã từ chối cấp quyền vị trí. Vui lòng bật vị trí hoặc chọn Tỉnh/Thành bên dưới.';
        } else if (err.code === 2) {
          msg = 'Không tìm thấy tín hiệu vị trí.';
        } else if (err.code === 3) {
          msg = 'Quá thời gian lấy vị trí GPS. Vui lòng thử lại.';
        }
        this.locationError.set(msg);
      },
      { timeout: 12000, enableHighAccuracy: true }
    );
  }

  // ── Lấy tọa độ trọng tâm Tỉnh/Thành đã chọn để định vị chuẩn xác ────
  getProvinceBiasCoords(): { lat: number; lng: number } {
    const prov = this.selectedProvince();
    if (prov) {
      for (const [key, coords] of Object.entries(PROVINCE_CENTERS)) {
        if (prov.name.includes(key) || key.includes(prov.name)) {
          return coords;
        }
      }
    }
    return { lat: 10.8703, lng: 106.7782 };
  }

  private normalizeSearchText(str: string): string {
    return (str || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/[^a-z0-9\s]/g, ' ')
      .trim();
  }

  private calculateDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = Math.sin(dLat/2) * Math.sin(dLat/2) +
              Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
              Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c;
  }

  private isProvinceMatch(p: NominatimPlace, provName: string): boolean {
    if (!provName) return true;
    const normProv = this.normalizeSearchText(provName).replace(/^(tinh|thanh pho|tp)\s+/i, '').trim();
    const allText = this.normalizeSearchText(`${p.state || ''} ${p.city || ''} ${p.district || ''} ${p.subtitle || ''} ${p.display_name}`);

    if (normProv.includes('ho chi minh') || normProv === 'hcm') {
      return allText.includes('ho chi minh') || allText.includes('hcm') || allText.includes('sai gon') || allText.includes('thu duc');
    }
    return allText.includes(normProv);
  }

  private parseAddressInput(rawInput: string, provName: string, wardName: string): {
    rawInput: string;
    cleanedText: string;
    fullNumber: string | null;
    baseNumber: string | null;
    streetName: string;
  } {
    let text = (rawInput || '').trim();

    // Loại bỏ tên tỉnh/thành, phường/xã bị gõ lặp lại trong ô địa chỉ
    const toStrip: string[] = [];
    if (provName) {
      toStrip.push(provName);
      const unPrefixed = provName.replace(/^(tỉnh|thành phố|tp)\s+/i, '').trim();
      toStrip.push(unPrefixed);
      toStrip.push(this.normalizeSearchText(unPrefixed));
    }
    if (wardName) {
      toStrip.push(wardName);
      const unPrefixedW = wardName.replace(/^(phường|xã|thị trấn)\s+/i, '').trim();
      toStrip.push(unPrefixedW);
      toStrip.push(this.normalizeSearchText(unPrefixedW));
    }
    toStrip.push('việt nam', 'viet nam', 'nha trang', 'hồ chí minh', 'hcm', 'hà nội', 'đà nẵng', 'khánh hòa');

    for (const s of toStrip) {
      if (!s || s.length < 2) continue;
      const escaped = s.replace(/[.*+?^$()|[\]\\]/g, '\\$&');
      const rx = new RegExp('(\\s*,?\\s*)\\b' + escaped + '(\\b|$)', 'gi');
      text = text.replace(rx, ' ').trim();
    }
    text = text.replace(/[\s,]+$/g, '').trim();

    // Nhận diện số nhà / ngõ hẻm đa tầng (ví dụ 303/7, 15A/2/3, 486...)
    const numMatch = text.match(/^(?:(?:so|số|hẻm|hem|ngách|ngach|ngõ|ngo|thôn|thon|tổ|to|ấp|ap)\s*)?([0-9]+[a-zA-Z]?(?:\/[0-9]+[a-zA-Z]?)*)\b(?:\s*,?\s*(?:đường|duong)\b|\s*,?\s*)/i);

    let fullNumber: string | null = null;
    let baseNumber: string | null = null;
    let streetName = text;

    if (numMatch) {
      fullNumber = numMatch[1];
      baseNumber = fullNumber.split('/')[0].replace(/[^\d]/g, '') || null;
      streetName = text.substring(numMatch[0].length).trim();
    }

    streetName = streetName.replace(/^(đường|duong)\s+/i, '').trim();
    streetName = streetName.replace(/[\s,]+$/g, '').trim();

    return {
      rawInput,
      cleanedText: text,
      fullNumber,
      baseNumber,
      streetName,
    };
  }

  /**
   * So khớp tên đường nghiêm ngặt: Tuyệt đối không để xảy ra trường hợp
   * các từ ngữ ngẫu nhiên (như "phòng chống" chứa "hong", "Lê Lai" chứa "le")
   * bị nhận nhầm thành "Lê Hồng Phong".
   */
  private matchesStreetPhrase(pText: string, streetName: string): boolean {
    if (!streetName || streetName.length < 2) return true;
    const normStreet = this.normalizeSearchText(streetName);
    const cleanPText = this.normalizeSearchText(pText);

    // 1. So khớp nguyên cụm tên đường (vd: "le hong phong")
    if (normStreet.length >= 3 && cleanPText.includes(normStreet)) {
      return true;
    }

    // 2. So khớp từng từ nguyên vẹn theo ranh giới từ
    const streetTokens = normStreet.split(/\s+/).filter(w => w.length > 1 && !['duong', 'so', 'nha', 'hem', 'ngach'].includes(w));
    if (streetTokens.length === 0) return true;

    const pWords = cleanPText.split(/\s+/);
    return streetTokens.every(tok => pWords.includes(tok));
  }

  private scoreCandidatePlace(
    place: NominatimPlace,
    parsed: { fullNumber: string | null; baseNumber: string | null; streetName: string },
    provName: string
  ): number {
    const pText = `${place.title || ''} ${place.streetName || ''} ${place.display_name || ''}`;

    if (!this.isProvinceMatch(place, provName)) return -1;
    if (parsed.streetName && parsed.streetName.length >= 3 && !this.matchesStreetPhrase(pText, parsed.streetName)) {
      return -1;
    }

    let score = 100;
    const cleanPText = this.normalizeSearchText(pText);
    const foundNums: string[] = (place.title || '').match(/\d+/g) || [];

    if (parsed.fullNumber && cleanPText.includes(this.normalizeSearchText(parsed.fullNumber))) {
      score += 1000;
    } else if (parsed.baseNumber && foundNums.includes(parsed.baseNumber)) {
      score += 800;
    } else if (parsed.baseNumber && foundNums.length > 0) {
      const target = parseInt(parsed.baseNumber, 10);
      let minDiff = 9999;
      for (const fn of foundNums) {
        const diff = Math.abs(parseInt(fn, 10) - target);
        if (diff < minDiff) minDiff = diff;
      }
      score += Math.max(200, 600 - minDiff * 2);
    } else {
      score += 300;
    }

    return score;
  }

  // ── Tự động gợi ý địa chỉ khi người dùng gõ phím ─────────────────────
  onStreetInput(val: string): void {
    this.streetInput.set(val);
    this.selectedSuggestion.set(null);

    if (this.searchStreetTimer) {
      clearTimeout(this.searchStreetTimer);
    }

    const query = val.trim();
    if (query.length < 2) {
      this.streetSuggestions.set([]);
      this.showSuggestionsDropdown.set(false);
      this.isSearchingSuggestions.set(false);
      return;
    }

    this.isSearchingSuggestions.set(true);
    this.searchStreetTimer = setTimeout(() => {
      const prov = this.selectedProvince();
      const ward = this.selectedWard();
      const wardCenter = this.wardCenterCoords();
      const bias = wardCenter || this.getProvinceBiasCoords();
      const provName = prov?.name || '';
      const wardName = ward?.name || '';

      const parsed = this.parseAddressInput(query, provName, wardName);
      const searchTarget = parsed.baseNumber
        ? `${parsed.baseNumber} ${parsed.streetName || query}`
        : (parsed.streetName || query);

      const searchQuery = provName
        ? `${searchTarget}, ${provName}`
        : searchTarget;

      this.shippingApi.searchAddressNominatim(searchQuery, bias.lat, bias.lng).subscribe({
        next: (places) => {
          // Lọc nghiêm ngặt: Tỉnh/Thành + Khớp tên đường thực tế
          const filtered = (places || []).filter(p => {
            const pText = `${p.title || ''} ${p.streetName || ''} ${p.display_name || ''}`;
            if (!this.isProvinceMatch(p, provName)) return false;
            if (parsed.streetName && parsed.streetName.length >= 3) {
              if (!this.matchesStreetPhrase(pText, parsed.streetName)) return false;
            }
            return true;
          });

          const ranked = [...filtered].sort((a, b) => {
            return this.scoreCandidatePlace(b, parsed, provName) - this.scoreCandidatePlace(a, parsed, provName);
          });

          this.isSearchingSuggestions.set(false);
          this.streetSuggestions.set(ranked);
          this.showSuggestionsDropdown.set(ranked.length > 0);
        },
        error: () => {
          this.isSearchingSuggestions.set(false);
          this.streetSuggestions.set([]);
          this.showSuggestionsDropdown.set(false);
        }
      });
    }, 280);
  }

  onStreetFocus(): void {
    if (this.streetSuggestions().length > 0) {
      this.showSuggestionsDropdown.set(true);
    }
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    if (!this.showSuggestionsDropdown()) return;
    const target = event.target as HTMLElement;
    if (target && !target.closest('.bhx-street-input-wrap')) {
      this.showSuggestionsDropdown.set(false);
    }
  }

  dismissSuggestions(): void {
    this.showSuggestionsDropdown.set(false);
  }

  onStreetEnter(e: Event): void {
    e.preventDefault();
    this.dismissSuggestions();
    if (this.canProceedToMap()) {
      this.proceedToMapConfirmation();
    }
  }

  clearStreetInput(): void {
    this.streetInput.set('');
    this.streetSuggestions.set([]);
    this.showSuggestionsDropdown.set(false);
    this.selectedSuggestion.set(null);
  }

  selectStreetSuggestion(item: NominatimPlace): void {
    this.selectedSuggestion.set(item);
    const lat = parseFloat(item.lat);
    const lng = parseFloat(item.lon);
    this.mapConfirmLat.set(lat);
    this.mapConfirmLng.set(lng);

    const displayStreet = item.title || item.streetName || item.display_name.split(',')[0] || item.display_name;
    this.streetInput.set(displayStreet);

    this.showSuggestionsDropdown.set(false);
    this.streetSuggestions.set([]);
  }

  // ── Chuyển sang bước Xác nhận địa chỉ nhận hàng trên bản đồ ───────────
  proceedToMapConfirmation(): void {
    const prov = this.selectedProvince();
    const ward = this.selectedWard();
    const street = this.streetInput().trim();

    if (!prov || !ward || !street) return;

    this.showSuggestionsDropdown.set(false);

    // Lưu địa chỉ giao hàng chính thức do người dùng nhập (không bao giờ bị ghi đè)
    const fullEnteredAddress = `${street}, ${ward.name}, ${prov.name}`;
    this.userEnteredAddress.set(fullEnteredAddress);

    const parsed = this.parseAddressInput(street, prov.name, ward.name);
    const wardCenter = this.wardCenterCoords();
    const bias = wardCenter || this.getProvinceBiasCoords();

    // TRƯỜNG HỢP 1: Người dùng đã chọn 1 gợi ý đã được thẩm định
    const chosen = this.selectedSuggestion();
    if (chosen && chosen.lat && chosen.lon) {
      const chosenText = `${chosen.title || ''} ${chosen.streetName || ''} ${chosen.display_name || ''}`;
      if (this.matchesStreetPhrase(chosenText, parsed.streetName)) {
        const lat = parseFloat(chosen.lat);
        const lng = parseFloat(chosen.lon);
        this.mapConfirmLat.set(lat);
        this.mapConfirmLng.set(lng);
        this.matchQuality.set('exact');
        this.resolveReferenceAddress(lat, lng);
        this.addressModalView.set('map');
        this.initConfirmMap();
        return;
      }
    }

    // TRƯỜNG HỢP 2: Người dùng nhập tay -> Định vị thông minh đa tầng
    this.isGeocoding.set(true);

    // BƯỚC 1: Nếu có số nhà (baseNumber), tìm ưu tiên theo số nhà chính: "${baseNumber} ${streetName}, ${prov.name}"
    const queryBaseNumber = parsed.baseNumber
      ? `${parsed.baseNumber} ${parsed.streetName}, ${prov.name}`
      : `${parsed.streetName || street}, ${prov.name}`;

    this.shippingApi.searchAddressNominatim(queryBaseNumber, bias.lat, bias.lng).subscribe({
      next: (places) => {
        const matchingPlaces = (places || []).filter(p => {
          const pText = `${p.title || ''} ${p.streetName || ''} ${p.display_name || ''}`;
          return this.isProvinceMatch(p, prov.name) && this.matchesStreetPhrase(pText, parsed.streetName);
        });

        if (matchingPlaces.length > 0) {
          matchingPlaces.sort((a, b) => this.scoreCandidatePlace(b, parsed, prov.name) - this.scoreCandidatePlace(a, parsed, prov.name));
          const best = matchingPlaces[0];
          const lat = parseFloat(best.lat);
          const lng = parseFloat(best.lon);
          this.mapConfirmLat.set(lat);
          this.mapConfirmLng.set(lng);
          this.matchQuality.set(parsed.baseNumber ? 'street_match' : 'exact');
          this.isGeocoding.set(false);
          this.resolveReferenceAddress(lat, lng);
          this.addressModalView.set('map');
          this.initConfirmMap();
          return;
        }

        // BƯỚC 2: Tìm kiếm theo tên đường trên phạm vi Tỉnh/Thành
        const queryStreetOnly = `${parsed.streetName || street}, ${prov.name}`;
        this.shippingApi.searchAddressNominatim(queryStreetOnly, bias.lat, bias.lng).subscribe({
          next: (places2) => {
            const streetPlaces = (places2 || []).filter(p => {
              const pText = `${p.title || ''} ${p.streetName || ''} ${p.display_name || ''}`;
              return this.isProvinceMatch(p, prov.name) && this.matchesStreetPhrase(pText, parsed.streetName);
            });

            if (streetPlaces.length > 0) {
              const bestStreet = streetPlaces[0];
              const lat = parseFloat(bestStreet.lat);
              const lng = parseFloat(bestStreet.lon);
              this.mapConfirmLat.set(lat);
              this.mapConfirmLng.set(lng);
              this.matchQuality.set('street_match');
              this.isGeocoding.set(false);
              this.resolveReferenceAddress(lat, lng);
              this.addressModalView.set('map');
              this.initConfirmMap();
              return;
            }

            // BƯỚC 3: Nếu không tìm thấy cả tên đường trên bản đồ -> Ghim tại trung tâm Phường/Xã
            this.fallbackToWardCenter(bias);
          },
          error: () => this.fallbackToWardCenter(bias)
        });
      },
      error: () => this.fallbackToWardCenter(bias)
    });
  }

  private fallbackToWardCenter(bias: { lat: number; lng: number }): void {
    const wardCenter = this.wardCenterCoords() || bias;
    this.isGeocoding.set(false);
    this.mapConfirmLat.set(wardCenter.lat);
    this.mapConfirmLng.set(wardCenter.lng);
    this.matchQuality.set('approximate');
    this.resolveReferenceAddress(wardCenter.lat, wardCenter.lng);
    this.addressModalView.set('map');
    this.initConfirmMap();
  }

  // ── Khởi tạo bản đồ Leaflet có ghim có thể di chuyển (Image 4) ────────
  private initConfirmMap(): void {
    setTimeout(() => {
      const el = document.getElementById('bhxConfirmMap');
      if (!el) return;

      this.destroyConfirmMap();

      const lat = this.mapConfirmLat();
      const lng = this.mapConfirmLng();

      this.confirmMap = L.map(el, {
        center: [lat, lng],
        zoom: 16,
        zoomControl: true,
      });

      const cartoKey = 'cb1_52qy_1_f631c7c88a518151e7549366';
      L.tileLayer(`https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png?key=${cartoKey}`, {
        attribution: '&copy; OpenStreetMap &copy; CARTO',
        subdomains: 'abcd',
        maxZoom: 19,
      }).addTo(this.confirmMap);

      const redPinIcon = L.divIcon({
        className: 'bhx-confirm-pin',
        html: `
          <div style="background:#e11d48;color:#fff;width:38px;height:38px;border-radius:50% 50% 50% 0;transform:rotate(-45deg);display:flex;align-items:center;justify-content:center;box-shadow:0 4px 10px rgba(0,0,0,0.35);border:2px solid #fff;cursor:grab;">
            <div style="width:12px;height:12px;background:#fff;border-radius:50%;transform:rotate(45deg);"></div>
          </div>
        `,
        iconSize: [38, 38],
        iconAnchor: [19, 38],
      });

      this.confirmMarker = L.marker([lat, lng], {
        icon: redPinIcon,
        draggable: true,
      }).addTo(this.confirmMap);

      this.confirmMarker.on('dragend', () => {
        const pos = this.confirmMarker?.getLatLng();
        if (pos) {
          this.mapConfirmLat.set(pos.lat);
          this.mapConfirmLng.set(pos.lng);
          this.matchQuality.set('manual');
          this.resolveReferenceAddress(pos.lat, pos.lng);
        }
      });

      this.confirmMap.on('click', (e: L.LeafletMouseEvent) => {
        this.mapConfirmLat.set(e.latlng.lat);
        this.mapConfirmLng.set(e.latlng.lng);
        this.confirmMarker?.setLatLng(e.latlng);
        this.matchQuality.set('manual');
        this.resolveReferenceAddress(e.latlng.lat, e.latlng.lng);
      });

      this.confirmMap.invalidateSize();
    }, 150);
  }

  private resolveReferenceAddress(lat: number, lng: number): void {
    this.isMapResolving.set(true);
    this.shippingApi.reverseGeocodeNominatim(lat, lng).subscribe({
      next: (addr) => {
        this.isMapResolving.set(false);
        this.referenceAddress.set(addr || `Tọa độ (${lat.toFixed(5)}, ${lng.toFixed(5)})`);
      },
      error: () => {
        this.isMapResolving.set(false);
        this.referenceAddress.set(`Tọa độ (${lat.toFixed(5)}, ${lng.toFixed(5)})`);
      }
    });
  }

  private destroyConfirmMap(): void {
    if (this.confirmMap) {
      this.confirmMap.remove();
      this.confirmMap = null;
      this.confirmMarker = null;
    }
  }

  // ── Người dùng nhấn "Hoàn tất" trên bản đồ (Image 4) ──────────────────
  confirmAddressComplete(): void {
    const finalAddr = this.userEnteredAddress().trim() ||
      [this.streetInput().trim(), this.selectedWard()?.name, this.selectedProvince()?.name].filter(Boolean).join(', ') ||
      this.referenceAddress().trim();

    const lat = this.mapConfirmLat();
    const lng = this.mapConfirmLng();

    this.shippingAddr.set(finalAddr);
    this.shippingCoordinates.set({ lat, lng });

    if (this.otherReceiverChecked()) {
      if (this.otherReceiverName().trim()) this.guestName.set(this.otherReceiverName().trim());
      if (this.otherReceiverPhone().trim()) this.guestPhone.set(this.otherReceiverPhone().trim());
    }

    const nearest = findNearestWarehouse(lat, lng, DEFAULT_WAREHOUSES);
    if (nearest?.id) {
      this.selectedPickupStoreId.set(nearest.id);
    }

    this.recalculateShipping(lat, lng);

    if (this.cart.currentUser()) {
      this.cart.addAddress({
        id: 'addr_' + Date.now(),
        label: 'Địa chỉ nhận hàng',
        address: finalAddr,
        city: this.selectedProvince()?.name || '',
        province: this.selectedProvince()?.name,
        provinceCode: this.selectedProvince()?.code,
        ward: this.selectedWard()?.name,
        wardCode: this.selectedWard()?.code,
        street: this.streetInput().trim(),
        lat,
        lng,
        fullName: this.currentReceiverName(),
        phone: this.currentReceiverPhone(),
        isDefault: true,
      });
    }

    this.closeAddressModal();
  }

  recalculateShipping(lat: number, lng: number): void {
    this.shippingApi.calculate(lat, lng, this.checkoutSubtotal()).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.shippingCalculation.set(res.data);
          if (res.data.warehouse?.id) {
            this.selectedPickupStoreId.set(res.data.warehouse.id);
          }
          if (!res.data.supported) {
            this.isOutOfRange.set(true);
            this.outOfRangeMessage.set(res.data.message || 'Khu vực giao hàng vượt quá bán kính 10km cho phép.');
          } else {
            this.isOutOfRange.set(false);
            this.outOfRangeMessage.set('');
          }
        }
      },
      error: (err) => {
        console.error('Lỗi tính phí giao hàng:', err);
      }
    });
  }

  selectPickupStore(store: StoreBranch): void {
    this.selectedPickupStoreId.set(store.id || 'store-thuduc');
    this.shippingAddr.set(`${store.name} - ${store.address}`);
  }

  toggleDeliveryTime(): void {
    this.deliveryTimeExpanded.set(!this.deliveryTimeExpanded());
  }

  setDeliveryType(type: 'instant' | 'standard' | 'timeslot'): void {
    this.selectedDeliveryType.set(type);
  }

  setDeliveryDay(day: 'today' | 'tomorrow'): void {
    this.selectedDeliveryDay.set(day);
  }

  setTimeSlot(slot: string): void {
    this.selectedTimeSlot.set(slot);
    this.selectedDeliveryType.set('timeslot');
  }

  handleSubmit(e: Event): void {
    e.preventDefault();

    const currentItems = this.checkoutItems();
    if (currentItems.length === 0) {
      this.errorMsg.set('Không có sản phẩm nào được chọn để thanh toán.'); return;
    }
    if (!this.guestName() || !this.guestPhone() || !this.guestEmail()) {
      this.errorMsg.set('Vui lòng điền đầy đủ thông tin liên hệ.'); return;
    }
    if (this.shippingMethod() === 'delivery' && !this.shippingAddr()) {
      this.errorMsg.set('Vui lòng thêm thông tin nhận hàng trước khi thanh toán.');
      this.openAddressModal();
      return;
    }

    if (this.shippingMethod() === 'delivery' && this.isOutOfRange()) {
      this.errorMsg.set(
        this.outOfRangeMessage() ||
          'Khu vực giao hàng vượt quá bán kính 10km cho phép đối với nông sản & thực phẩm mát. Vui lòng chọn điểm nhận hàng gần hơn hoặc chọn "Đến lấy trực tiếp".'
      );
      return;
    }

    // Bật modal popup thông báo kiểm tra hàng & đồng kiểm khi khách hàng nhấn xác nhận đặt hàng nếu chưa tick đồng ý
    if (!this.nonRefundableConfirmed()) {
      this.modalPolicyChecked.set(false);
      this.showNonRefundableModal.set(true);
      return;
    }

    this.executeOrderPlacement();
  }

  confirmNonRefundableAndPlaceOrder(): void {
    if (!this.modalPolicyChecked()) return;
    this.nonRefundableConfirmed.set(true);
    this.showNonRefundableModal.set(false);
    this.executeOrderPlacement();
  }

  closeNonRefundableModal(): void {
    this.showNonRefundableModal.set(false);
    this.modalPolicyChecked.set(false);
  }

  executeOrderPlacement(): void {
    const currentItems = this.checkoutItems();
    if (currentItems.length === 0) {
      this.errorMsg.set('Không có sản phẩm nào được chọn để thanh toán.'); return;
    }

    this.submitting.set(true);
    this.errorMsg.set('');

    // Build order payload — product field là MongoDB _id nếu có (từ API),
    // hoặc bỏ qua nếu là static data (slug string)
    const items = currentItems.map(i => {
      const prod = i.product as any;
      // id có dạng 24-char hex (MongoDB ObjectId)
      const isObjectId = /^[a-f\d]{24}$/i.test(prod.id ?? '');
      const itemType = i.product.isCombo
        ? 'combo'
        : (i.itemType === 'addon' ? 'addon' : 'regular');
      return {
        ...(isObjectId ? { product: prod.id } : { product: i.product.slug }),
        productName:       i.product.name,
        productImage:      i.product.image,
        productPrice:      i.product.price,
        priceNumber:       i.product.priceNumber,
        quantity:          i.quantity,
        selectedOption:    i.selectedOption ?? '',
        isCombo:           !!i.product.isCombo,
        itemType,
        linkedMainProduct: itemType === 'addon' ? (i.linkedMainProductId || i.linkedMainProductSlug || '') : '',
        comboItems:        i.product.comboItems || [],
      };
    });

    // Không gửi `user`: server lấy chủ đơn hàng từ token đăng nhập.
    const payload = {
      guestName:           this.guestName(),
      guestEmail:          this.guestEmail(),
      guestPhone:          this.guestPhone(),
      items,
      subtotal:            this.checkoutSubtotal(),
      comboDiscount:       this.comboDiscount(),
      addonDiscount:       this.addonDiscount(),
      discount:            this.voucherDiscount(),
      voucherCode:         this.selectedVoucher()?.code || null,
      shippingFee:         this.shippingFee(),
      shippingDiscount:    this.shippingDiscount(),
      shippingDistanceKm:  this.shippingCalculation()?.distanceKm || 0,
      shippingCoordinates: this.shippingCoordinates(),
      total:               this.finalTotal(),
      shippingMethod:      this.shippingMethod(),
      shippingAddress:     this.shippingMethod() === 'pickup'
        ? `${this.selectedPickupStore().name} - ${this.selectedPickupStore().address}`
        : this.shippingAddr(),
      pickupStore:         this.shippingMethod() === 'pickup' ? this.selectedPickupStore() : null,
      deliveryTimeSlot:    this.selectedDeliveryTimeString(),
      deliveryType:        this.shippingMethod() === 'delivery' ? this.selectedDeliveryType() : 'pickup',
      estimatedDeliveryTime: this.selectedDeliveryTimeString(),
      paymentMethod:       this.paymentMethod(),
      estimatedPoints:     this.estimatedPoints(),
      hasNonRefundableItems: this.nonRefundablePolicy().hasNonRefundableItems,
      nonRefundableAccepted: this.nonRefundableConfirmed(),
      nonRefundableItems:    this.nonRefundablePolicy().items,
    };

    this.orderApi.create(payload as any).subscribe({
      next: (res: any) => {
        this.submitting.set(false);
        const code = res.data?.orderCode || res.orderCode;
        const total = res.data?.total ?? res.total ?? this.finalTotal();
        const qr = res.data?.qrUrl || res.qrUrl || null;
        const bank = res.data?.bankInfo || (this.paymentMethod() === 'bank_transfer' ? {
          bankId: 'MB',
          accountNo: '0962299122',
          accountName: 'VY TAM NHU'
        } : null);

        this.orderCode.set(code);
        this.createdTotal.set(total);
        this.qrUrl.set(qr);
        this.bankInfo.set(bank);
        this.completed.set(true);

        // Đồng bộ lại dữ liệu tài khoản từ server sau khi đặt hàng
        this.cart.loadUserData();

        // Voucher đã dùng được server đánh dấu → tải lại; điểm được cộng khi đơn giao thành công
        this.voucher.refreshMine();

        this.cart.removeSelectedItems();
      },
      error: (err) => {
        this.submitting.set(false);
        this.errorMsg.set(err.error?.message || 'Đặt hàng thất bại, vui lòng thử lại.');
      },
    });
  }

  /** Sao chép thông tin (STK hoặc Nội dung CK) vào clipboard kèm thông báo */
  copyToClipboard(text: string, fieldName: string): void {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      this.copiedField.set(fieldName);
      setTimeout(() => {
        if (this.copiedField() === fieldName) {
          this.copiedField.set(null);
        }
      }, 2000);
    }).catch(() => {
      this.copiedField.set(fieldName);
      setTimeout(() => this.copiedField.set(null), 2000);
    });
  }

  getComboItemName(it: any): string {
    return it?.product?.name || it?.name || 'Sản phẩm';
  }

  getComboItemQty(it: any): number {
    return Number(it?.quantity || 1);
  }

  getComboItemImage(it: any): string {
    return it?.product?.image || it?.image || '';
  }

  getComboItemPrice(it: any): string {
    if (it?.price) return String(it.price);
    if (it?.product?.price) return String(it.product.price);
    if (it?.priceNumber) return this.formatPrice(it.priceNumber);
    if (it?.product?.priceNumber) return this.formatPrice(it.product.priceNumber);
    return '';
  }
}
