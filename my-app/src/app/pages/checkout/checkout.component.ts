import { Component, signal, inject, computed, effect, OnInit, OnDestroy } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ShellComponent } from '../../components/shell/shell.component';
import { CartService, formatPrice, getCartItemKey, CartPricingTotals, resolveProductMaxStock } from '../../shared/services/cart.service';
import { OrderApiService } from '../../shared/services/order-api.service';
import { ProductApiService, ApiProduct } from '../../shared/services/product-api.service';
import { VoucherService } from '../../shared/services/voucher.service';
import { Voucher, XanhLaCartItem, EvaluatedCartItemPricing, XanhLaAddress } from '../../shared/models/xanh-la.models';
import {
  ShippingApiService,
  ShippingCalculationResult,
  WarehouseLocation,
  DEFAULT_WAREHOUSES,
  findNearestWarehouse,
} from '../../shared/services/shipping-api.service';
import {
  AddressPickerModalComponent,
  AddressPickerResult,
  PROVINCE_CENTERS,
} from '../../components/address-picker-modal/address-picker-modal.component';

export { PROVINCE_CENTERS };

export interface CheckoutVoucherOption {
  voucher: Voucher;
  inWallet: boolean;
  isEligible: boolean;
  estimatedDiscount: number;
}

export interface NonRefundableItemSummary {
  name: string;
  categoryName: string;
  image?: string;
  quantity?: number;
  isCombo?: boolean;
}

export type StoreBranch = WarehouseLocation & { id: string };
export const STORE_BRANCHES: StoreBranch[] = DEFAULT_WAREHOUSES as StoreBranch[];

export interface BaseTimeSlotDefinition {
  label: string;
  startHour: number; // số giờ thập phân (7.5 = 07:30)
  endHour: number;   // số giờ thập phân (9.0 = 09:00)
}

export const BASE_TIME_SLOTS: BaseTimeSlotDefinition[] = [
  { label: 'Từ 07h30 - 09h00', startHour: 7.5, endHour: 9.0 },
  { label: 'Từ 09h00 - 11h00', startHour: 9.0, endHour: 11.0 },
  { label: 'Từ 11h00 - 13h00', startHour: 11.0, endHour: 13.0 },
  { label: 'Từ 13h00 - 15h00', startHour: 13.0, endHour: 15.0 },
  { label: 'Từ 15h00 - 17h00', startHour: 15.0, endHour: 17.0 },
  { label: 'Từ 17h00 - 19h00', startHour: 17.0, endHour: 19.0 },
  { label: 'Từ 19h00 - 20h30', startHour: 19.0, endHour: 20.5 },
  { label: 'Từ 20h30 - 22h00', startHour: 20.5, endHour: 22.0 },
];

export interface EvaluatedTimeSlot {
  label: string;
  startHour: number;
  endHour: number;
  originalPrice: number;
  finalPrice: number;
  isFreeship: boolean;
  isAvailable: boolean;
  unavailableReason?: string;
}

export const DELIVERY_TIME_SLOTS = BASE_TIME_SLOTS;

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
  imports: [CommonModule, FormsModule, ShellComponent, RouterLink, AddressPickerModalComponent],
  templateUrl: './checkout.component.html',
  styleUrl: './checkout.component.css',
})
export class CheckoutComponent implements OnInit, OnDestroy {
  protected cart     = inject(CartService);
  private orderApi   = inject(OrderApiService);
  private productApi = inject(ProductApiService);
  private router     = inject(Router);
  private route      = inject(ActivatedRoute);
  protected voucher  = inject(VoucherService);
  private shippingApi = inject(ShippingApiService);
  protected formatPrice = formatPrice;

  private liveProductsByKey = signal<Map<string, ApiProduct>>(new Map());

  protected completed      = signal(false);
  protected guestOrderSubmitted = signal(false);
  protected orderCode      = signal('');
  protected submitting     = signal(false);
  protected submitAttempted = signal(false);
  protected errorMsg       = signal('');
  protected shippingMethod = signal<'pickup' | 'delivery'>('delivery');
  protected paymentMethod  = signal<'cod' | 'bank_transfer'>('cod');

  // VietQR & Chuyển khoản ngân hàng (chờ thanh toán -> polling -> hoàn tất)
  protected qrUrl           = signal<string | null>(null);
  protected createdTotal    = signal<number>(0);
  protected bankInfo        = signal<{ bankId: string; accountNo: string; accountName: string } | null>(null);
  protected copiedField     = signal<string | null>(null);
  protected qrPaymentStatus = signal<'unpaid' | 'paid' | 'expired'>('unpaid');
  protected qrExpiresAt     = signal<Date | null>(null);
  protected qrCountdownText = signal<string>('15:00');
  protected qrPaidAt        = signal<string | null>(null);
  protected qrChecking      = signal<boolean>(false);
  protected qrCancelling    = signal<boolean>(false);
  protected qrStatusNote    = signal<string>('');
  private qrPollTimer: ReturnType<typeof setInterval> | null = null;
  private qrCountdownTimer: ReturnType<typeof setInterval> | null = null;

  // Khuyến mãi kép (Dual Voucher: 1 Voucher Giảm Giá Đơn Hàng + 1 Voucher Freeship)
  protected voucherCode = signal('');
  protected voucherMessage = signal('');
  private pendingQueryVoucher = signal('');

  // 1. Voucher giảm giá sản phẩm / đơn hàng
  protected selectedOrderVoucher = signal<{ code: string; discount: number; voucher: Voucher } | null>(null);
  protected showOrderVoucherPicker = signal(false);

  // 2. Voucher miễn phí / hỗ trợ vận chuyển (Freeship)
  protected selectedShippingVoucher = signal<{ code: string; discount: number; voucher: Voucher } | null>(null);
  protected showShippingVoucherPicker = signal(false);

  // Computed tương thích ngược
  protected selectedVoucher = computed(() => this.selectedOrderVoucher());
  protected voucherDiscount = computed(() => this.orderVoucherDiscount());
  protected showVoucherPicker = computed(() => this.showOrderVoucherPicker());

  // Modal Địa chỉ nhận hàng (Bách Hoá XANH style)
  protected showAddressModal = signal(false);

  // Người nhận hiện tại hiển thị trên thẻ tóm tắt địa chỉ
  readonly receiverSummary = computed(() => {
    const name = this.guestName() || this.cart.currentUser()?.name || 'Khách hàng';
    const phone = this.guestPhone() || this.cart.currentUser()?.phone || '';
    if (name && phone) return `${name}, ${phone}`;
    if (name) return name;
    if (phone) return phone;
    return 'Chưa có thông tin người nhận';
  });

  protected isBuyNowQuery = signal(this.route.snapshot.queryParamMap.get('mode') === 'buynow');

  readonly isBuyNowMode = computed(() => {
    return this.isBuyNowQuery() && (this.cart.buyNowSession()?.length ?? 0) > 0;
  });

  // Chỉ thanh toán các món trong phiên Mua Ngay hoặc các món được chọn trong giỏ hàng
  readonly checkoutItems = computed(() => {
    return this.isBuyNowMode() ? (this.cart.buyNowSession() || []) : this.cart.selectedItems();
  });

  // DRY: Tổng hợp số liệu tài chính qua 1 signal đại diện duy nhất
  readonly activeTotals = computed<CartPricingTotals>(() => {
    return this.isBuyNowMode() ? this.cart.buyNowTotals() : this.cart.selectedTotals();
  });

  readonly checkoutSubtotal = computed(() => this.activeTotals().subtotal);
  readonly originalSubtotal = computed(() => this.activeTotals().originalSubtotal);
  readonly comboDiscount    = computed(() => this.activeTotals().comboDiscount);
  readonly addonDiscount    = computed(() => this.activeTotals().addonDiscount);

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

      const live = this.findLiveProduct(it);
      const effectiveProd: any = live || prod;
      const isCombo = Boolean(
        prod.isCombo || it.isCombo || it.itemType === 'combo' ||
        effectiveProd?.isCombo || (Array.isArray(prod.comboItems) && prod.comboItems.length > 0)
      );

      if (isCombo && Array.isArray(effectiveProd?.comboItems) && effectiveProd.comboItems.length > 0) {
        const comboCheck = isFreshPerishableProduct(effectiveProd);
        let comboIsFresh = comboCheck.isFresh;
        const subNames: string[] = [];
        for (const ci of effectiveProd.comboItems) {
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
            image: prod.image || effectiveProd?.image || '',
            quantity: it.quantity || 1,
            isCombo: true,
          });
        }
      } else {
        const check = isFreshPerishableProduct(effectiveProd);
        if (check.isFresh) {
          freshList.push({
            name: prod.name,
            categoryName: check.categoryName,
            image: prod.image || effectiveProd?.image || '',
            quantity: it.quantity || 1,
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

  readonly checkoutStockCheck = computed(() => {
    const items = this.checkoutItems();
    const map = this.liveProductsByKey();
    const issuesByKey = new Map<string, { maxQty: number; reason: string; isOutOfStock: boolean }>();
    const errorMessages: string[] = [];
    const componentDemand = new Map<string, { name: string; totalNeed: number; stock: number }>();

    const registerComponentDemand = (compProd: any, needQty: number) => {
      if (!compProd) return;
      const compId = String(compProd._id || compProd.id || compProd.slug || '');
      if (!compId) return;
      const cleanCompSlug = compProd.slug ? String(compProd.slug).replace(/^\/product-page\//, '').replace(/^\//, '') : '';
      const liveComp = map.get(compId) || map.get(String(compProd.slug || '')) || map.get(cleanCompSlug);
      const stock = typeof liveComp?.stock === 'number'
        ? Math.max(0, Math.floor(liveComp.stock))
        : (typeof compProd.stock === 'number' ? Math.max(0, Math.floor(compProd.stock)) : null);
      if (stock === null) return;
      const prev = componentDemand.get(compId);
      componentDemand.set(compId, {
        name: liveComp?.name || compProd.name || 'Sản phẩm',
        totalNeed: (prev?.totalNeed || 0) + needQty,
        stock,
      });
    };

    for (const item of items) {
      const key = getCartItemKey(item);
      const live = this.findLiveProduct(item);
      const p: any = live || item.product;
      const isCombo = Boolean(
        p?.isCombo || item.isCombo || item.itemType === 'combo' ||
        (Array.isArray(p?.comboItems) && p.comboItems.length > 0)
      );

      let maxQty: number | null = null;
      let reason = '';

      if (p?.isActive === false) {
        maxQty = 0;
        reason = `"${item.product.name}" hiện đã ngừng kinh doanh.`;
      } else if (isCombo) {
        if (p?.comboStatus === 'paused' || p?.comboStatus === 'hidden') {
          maxQty = 0;
          reason = `Combo "${item.product.name}" hiện đang tạm ngừng kinh doanh.`;
        } else {
          const avStock = typeof p?.availableStock === 'number'
            ? Math.max(0, Math.floor(p.availableStock))
            : (typeof p?.stock === 'number' ? Math.max(0, Math.floor(p.stock)) : null);
          if (avStock !== null) {
            maxQty = avStock;
            if (avStock <= 0) {
              const limName = live?.limitingItem?.name;
              reason = limName
                ? `Thành phần "${limName}" của "${item.product.name}" hiện đã hết tồn kho.`
                : `Combo "${item.product.name}" hiện đã hết hàng.`;
            } else if (item.quantity > avStock) {
              reason = `"${item.product.name}" chỉ còn đủ tồn kho cho tối đa ${avStock} combo.`;
            }
          }
          if (Array.isArray(p?.comboItems)) {
            for (const ci of p.comboItems) {
              const subProd = typeof ci.product === 'object' ? ci.product : map.get(String(ci.product || ''));
              const perCombo = Math.max(1, Number(ci.quantity) || 1);
              registerComponentDemand(subProd, perCombo * item.quantity);
            }
          }
        }
      } else {
        const prodStock = typeof p?.stock === 'number' ? Math.max(0, Math.floor(p.stock)) : null;
        if (prodStock !== null) {
          maxQty = prodStock;
          if (prodStock <= 0) {
            reason = `"${item.product.name}" hiện đã hết tồn kho.`;
          } else if (item.quantity > prodStock) {
            reason = `"${item.product.name}" chỉ còn ${prodStock} sản phẩm trong kho.`;
          }
        }
        registerComponentDemand(p, item.quantity);
      }

      if (reason) {
        issuesByKey.set(key, { maxQty: maxQty ?? 0, reason, isOutOfStock: (maxQty ?? 0) <= 0 });
        errorMessages.push(reason);
      } else if (maxQty !== null) {
        issuesByKey.set(key, { maxQty, reason: '', isOutOfStock: maxQty <= 0 });
      }
    }

    for (const entry of componentDemand.values()) {
      if (entry.totalNeed > entry.stock) {
        const msg = entry.stock <= 0
          ? `Sản phẩm "${entry.name}" hiện đã hết tồn kho (cần ${entry.totalNeed}, hiện còn 0).`
          : `Tổng số lượng "${entry.name}" cần cho đơn (${entry.totalNeed}) vượt quá tồn kho hiện tại (chỉ còn ${entry.stock}).`;
        if (!errorMessages.includes(msg)) {
          errorMessages.push(msg);
        }
      }
    }

    return {
      issuesByKey,
      hasIssues: errorMessages.length > 0,
      firstError: errorMessages[0] || '',
      errorMessages,
    };
  });

  private findLiveProduct(item: XanhLaCartItem): ApiProduct | undefined {
    const map = this.liveProductsByKey();
    if (!map.size) return undefined;
    const p: any = item.product;
    const rawSlug = String(p?.slug || '');
    const cleanSlug = rawSlug.replace(/^\/product-page\//, '').replace(/^\//, '');
    return map.get(String(p?.id || '')) || map.get(String(p?._id || '')) || map.get(rawSlug) || map.get(cleanSlug);
  }

  private loadLiveProductStock(): void {
    this.productApi.getAll({ limit: 500 }).subscribe({
      next: (res) => {
        const list = res?.data || [];
        const map = new Map<string, ApiProduct>();
        for (const p of list) {
          if (p._id) map.set(p._id, p);
          if (p.slug) {
            map.set(p.slug, p);
            const cleanSlug = p.slug.replace(/^\/product-page\//, '').replace(/^\//, '');
            if (cleanSlug) map.set(cleanSlug, p);
          }
        }
        this.liveProductsByKey.set(map);
      },
      error: () => {},
    });
  }

  itemPricing(item: XanhLaCartItem): EvaluatedCartItemPricing {
    const live = this.findLiveProduct(item);
    const enrichedItem: XanhLaCartItem = live && (live.isCombo || (Array.isArray(live.comboItems) && live.comboItems.length > 0))
      ? {
          ...item,
          isCombo: true,
          itemType: 'combo',
          product: {
            ...item.product,
            isCombo: true,
            originalPriceNumber: item.product.originalPriceNumber ?? live.originalPriceNumber,
          },
        }
      : item;
    return this.cart.getItemPricing(enrichedItem, this.isBuyNowMode() ? 'buynow' : 'selected');
  }

  getCheckoutItemMaxStock(item: XanhLaCartItem): number {
    const live = this.findLiveProduct(item);
    if (live) {
      if (live.isActive === false || live.comboStatus === 'paused' || live.comboStatus === 'hidden') return 0;
      const s = live.isCombo && typeof live.availableStock === 'number' ? live.availableStock : live.stock;
      if (typeof s === 'number') return Math.max(0, Math.floor(s));
    }
    const localMax = resolveProductMaxStock(item.product);
    return localMax !== null ? localMax : 99;
  }

  getCheckoutItemStockWarning(item: XanhLaCartItem): string {
    return this.checkoutStockCheck().issuesByKey.get(getCartItemKey(item))?.reason || '';
  }

  removeOutOfStockItem(item: XanhLaCartItem): void {
    if (this.isBuyNowMode()) {
      this.cart.clearBuyNowSession();
      this.router.navigate(['/online-ordering']);
      return;
    }
    this.cart.removeCartItem(item);
    this.errorMsg.set('');
  }

  adjustCheckoutItemQty(item: XanhLaCartItem, delta: number): void {
    const maxStock = this.getCheckoutItemMaxStock(item);
    if (delta > 0 && item.quantity >= maxStock) return;
    const upperBound = maxStock > 0 ? Math.min(99, maxStock) : item.quantity;
    const nextQty = Math.max(1, Math.min(upperBound, item.quantity + delta));
    if (nextQty === item.quantity) return;
    if (this.isBuyNowMode()) {
      this.cart.updateBuyNowItemQuantity(item, nextQty);
    } else {
      this.cart.updateItemQuantity(item, nextQty);
    }
    if (!this.checkoutStockCheck().hasIssues) {
      this.errorMsg.set('');
    }
  }

  isMainOfAddon(item: XanhLaCartItem): boolean {
    const slug = item.product?.slug || '';
    const id = (item.product as any)?._id || (item.product as any)?.id || '';
    return this.checkoutItems().some(i =>
      i.itemType === 'addon' &&
      ((i.linkedMainProductSlug && i.linkedMainProductSlug === slug) ||
       (i.linkedMainProductId && (i.linkedMainProductId === id || i.linkedMainProductId === slug)))
    );
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

  /** Kiểm tra voucher có phải là mã giảm phí vận chuyển / Freeship hay không */
  isShippingVoucher(v: Voucher): boolean {
    if (!v) return false;
    const text = `${v.code} ${v.name || ''} ${v.description || ''}`.toLowerCase();
    return v.code.toUpperCase() === 'FREESHIP' || /freeship|vận chuyển|giao hàng|phí ship/.test(text);
  }

  /** Danh sách voucher giảm giá đơn hàng / sản phẩm */
  readonly orderVoucherOptions = computed<CheckoutVoucherOption[]>(() => {
    return this.checkoutVoucherOptions().filter(opt => !this.isShippingVoucher(opt.voucher));
  });

  /** Danh sách voucher miễn phí / hỗ trợ vận chuyển (Freeship) */
  readonly shippingVoucherOptions = computed<CheckoutVoucherOption[]>(() => {
    const list = this.checkoutVoucherOptions().filter(opt => this.isShippingVoucher(opt.voucher));
    if (list.length === 0) {
      const sub = this.checkoutSubtotal();
      const minVal = 100000;
      const isEligible = sub >= minVal;
      const fallbackVoucher: Voucher = {
        code: 'FREESHIP',
        name: 'Hỗ Trợ Phí Giao Hàng 30K',
        description: 'Giảm ngay 30.000đ chi phí vận chuyển xe lạnh trong ngày cho đơn hàng từ 100.000đ.',
        type: 'fixed',
        value: 30000,
        minValue: 100000,
      } as any;
      return [{
        voucher: fallbackVoucher,
        inWallet: true,
        isEligible,
        estimatedDiscount: 30000,
      }];
    }
    return list;
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

  protected pickupProvinceFilter = signal<string>('all');
  protected pickupSearchQuery = signal<string>('');
  protected confirmedDeliveryProvince = signal<string>('');
  private lastAutoScopedAddressKey = '';

  readonly pickupProvinces = computed<string[]>(() => {
    const set = new Set<string>();
    for (const b of this.storeBranches) {
      if (b.province) set.add(b.province);
    }
    return Array.from(set);
  });

  private matchBranchProvinceFromText(text: string): string | null {
    const norm = this.normalizeSearchText(text || '');
    if (!norm) return null;

    for (const prov of this.pickupProvinces()) {
      const stripped = this.normalizeSearchText(prov).replace(/^(tinh|thanh pho|tp)\s+/i, '').trim();
      if (stripped && norm.includes(stripped)) {
        return prov;
      }
    }

    const aliases: Array<[string[], string]> = [
      [['hcm', 'tp hcm', 'tphcm', 'sai gon', 'thu duc'], 'Thành phố Hồ Chí Minh'],
      [['hanoi', 'ha noi'], 'Thành phố Hà Nội'],
      [['danang', 'da nang'], 'Thành phố Đà Nẵng'],
      [['binh duong', 'di an', 'thuan an', 'thu dau mot'], 'Tỉnh Bình Dương'],
      [['dong nai', 'bien hoa', 'long thanh'], 'Tỉnh Đồng Nai'],
      [['nha trang', 'cam ranh', 'khanh hoa'], 'Tỉnh Khánh Hòa'],
      [['buon ma thuot', 'dak lak', 'daklak'], 'Tỉnh Đắk Lắk'],
      [['can tho', 'cantho', 'ninh kieu'], 'Thành phố Cần Thơ'],
      [['vung tau', 'ba ria'], 'Tỉnh Bà Rịa - Vũng Tàu'],
      [['da lat', 'dalat', 'bao loc', 'lam dong'], 'Tỉnh Lâm Đồng'],
    ];

    for (const [keys, canonical] of aliases) {
      if (keys.some(k => norm.includes(k))) {
        return canonical;
      }
    }
    return null;
  }

  // Khách hàng đã nhập/lưu địa chỉ nhận hàng hay chưa
  readonly hasEnteredCustomerAddress = computed<boolean>(() => {
    return Boolean(this.shippingAddr().trim()) || Boolean(this.confirmedDeliveryProvince().trim());
  });

  // Tỉnh/Thành có cửa hàng khớp với địa chỉ khách đã nhập (null nếu chưa nhập hoặc tỉnh chưa có chi nhánh)
  readonly customerMatchedPickupProvince = computed<string | null>(() => {
    if (!this.hasEnteredCustomerAddress()) return null;
    const hint = this.confirmedDeliveryProvince().trim();
    if (hint) {
      const matchedHint = this.matchBranchProvinceFromText(hint);
      if (matchedHint) return matchedHint;
    }
    return this.matchBranchProvinceFromText(this.shippingAddr());
  });

  readonly customerAddressProvinceLabel = computed<string>(() => {
    const matched = this.customerMatchedPickupProvince();
    if (matched) return matched;
    if (this.confirmedDeliveryProvince().trim()) return this.confirmedDeliveryProvince().trim();
    const parts = this.shippingAddr().split(',').map(s => s.trim()).filter(Boolean);
    return parts.length > 0 ? parts[parts.length - 1] : 'khu vực của bạn';
  });

  readonly filteredStoreBranches = computed<StoreBranch[]>(() => {
    const prov = this.pickupProvinceFilter();
    const q = this.pickupSearchQuery().trim().toLowerCase();
    return this.storeBranches.filter(store => {
      const matchProv = prov === 'all' || store.province === prov;
      const matchQuery = !q ||
        store.name.toLowerCase().includes(q) ||
        store.address.toLowerCase().includes(q) ||
        (store.district && store.district.toLowerCase().includes(q));
      return matchProv && matchQuery;
    });
  });

  // Kho / Cửa hàng giao từ tự động lấy điểm gần nhất theo địa chỉ nhận hàng
  readonly nearestWarehouse = computed<WarehouseLocation>(() => {
    // 1. Ưu tiên kho đã được API tính toán phí ship xác nhận (theo tọa độ OSRM)
    const calculatedWh = this.shippingCalculation()?.warehouse;
    if (calculatedWh && calculatedWh.name && calculatedWh.address) {
      return calculatedWh;
    }

    // 2. Nếu đã có tọa độ giao hàng đã xác nhận
    const coords = this.shippingCoordinates();
    if (coords?.lat && coords?.lng) {
      return findNearestWarehouse(coords.lat, coords.lng, DEFAULT_WAREHOUSES);
    }

    // 3. Nếu người dùng có tọa độ từ sổ địa chỉ đã lưu
    const defAddr = this._defaultAddressObj();
    if (defAddr?.lat && defAddr?.lng) {
      return findNearestWarehouse(defAddr.lat, defAddr.lng, DEFAULT_WAREHOUSES);
    }

    // 4. Nếu người dùng đã chọn Tỉnh/Thành phố
    const provName = this.confirmedDeliveryProvince().trim();
    if (provName) {
      const pName = provName.toLowerCase();
      const match = DEFAULT_WAREHOUSES.find(w =>
        w.province && (w.province.toLowerCase().includes(pName) || pName.includes(w.province.toLowerCase()))
      );
      if (match) return match;

      for (const [key, center] of Object.entries(PROVINCE_CENTERS)) {
        if (provName.includes(key) || key.includes(provName)) {
          return findNearestWarehouse(center.lat, center.lng, DEFAULT_WAREHOUSES);
        }
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
  readonly baseTimeSlots = BASE_TIME_SLOTS;
  readonly deliveryTimeSlots = BASE_TIME_SLOTS;
  protected deliveryTimeExpanded = signal<boolean>(true);
  protected selectedDeliveryType = signal<'instant' | 'standard' | 'timeslot'>('timeslot');
  protected selectedDeliveryDay = signal<'today' | 'tomorrow'>('today');
  protected selectedTimeSlot = signal<string>('Từ 07h30 - 09h00');

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

  // Vận chuyển & Bản đồ định vị
  private readonly LAST_LOCATION_STORAGE_KEY = 'xanhla_checkout_last_location_v1';
  protected shippingCoordinates = signal<{ lat: number; lng: number } | null>(null);
  protected shippingCalculation = signal<ShippingCalculationResult | null>(null);
  protected isOutOfRange = signal(false);
  protected outOfRangeMessage = signal('');
  protected isCalculatingShipping = signal(false);

  // Kiểm tra đã có vị trí giao hàng xác thực chưa (không đoán mò khi khách chưa nhập)
  readonly hasDeliveryLocation = computed<boolean>(() => {
    if (this.shippingMethod() === 'pickup') return true;
    return Boolean(this.shippingAddr().trim()) && (Boolean(this.shippingCoordinates()) || Boolean(this.shippingCalculation()));
  });

  // Danh sách tỉnh/thành đã có cửa hàng (tái sử dụng pickupProvinces)
  readonly servedProvincesSummary = computed<string>(() => {
    return this.pickupProvinces()
      .map(p => p.replace(/^(Thành phố|Tỉnh)\s+/i, '').trim())
      .join(', ');
  });

  // Khoảng cách thực tế (km)
  readonly shippingDistanceKm = computed(() => {
    return this.shippingCalculation()?.distanceKm ?? 0;
  });

  // Đang thuộc vùng giao xa có phụ thu (10 km < distance <= 20 km)
  readonly isFarDelivery = computed<boolean>(() => {
    if (this.shippingMethod() === 'pickup' || !this.hasDeliveryLocation() || this.shippingUnsupported()) {
      return false;
    }
    const calc = this.shippingCalculation();
    if (calc && typeof calc.isFarDelivery === 'boolean') {
      return calc.isFarDelivery;
    }
    const dist = this.shippingDistanceKm();
    return dist > 10 && dist <= 20;
  });

  // Mức phụ thu giao xa (+5.000đ/km vượt quá 10km tiêu chuẩn)
  readonly farDeliverySurcharge = computed<number>(() => {
    if (!this.isFarDelivery()) return 0;
    const calc = this.shippingCalculation();
    if (calc && typeof calc.farSurcharge === 'number') {
      return calc.farSurcharge;
    }
    return Math.ceil(Math.max(0, this.shippingDistanceKm() - 10)) * 5000;
  });

  // Phí nền theo khoảng cách (dùng chung cho mọi gói giao hàng để tránh trùng lặp logic)
  readonly resolvedDistanceBaseFee = computed<number>(() => {
    const apiBase = this.shippingCalculation()?.baseFee;
    if (apiBase && apiBase > 0) return apiBase;
    const dist = this.shippingDistanceKm();
    if (dist <= 0) return 20000;
    if (dist <= 2) return 15000;
    if (dist <= 5) return 20000;
    if (dist <= 8) return 25000;
    if (dist <= 10) return 30000;
    return 30000 + Math.ceil(dist - 10) * 5000;
  });

  // Phí ship gốc theo khoảng cách và loại hình giao (trả về 0 nếu chưa có vị trí giao hàng)
  readonly baseShippingFee = computed<number>(() => {
    if (this.shippingMethod() === 'pickup' || !this.hasDeliveryLocation()) return 0;
    const type = this.selectedDeliveryType();
    const distBase = this.resolvedDistanceBaseFee();

    if (type === 'instant') {
      return distBase + 10000; // Phí hỏa tốc cộng thêm 10.000đ
    }
    if (type === 'standard') {
      return 15000 + this.farDeliverySurcharge(); // Tiết kiệm 24h + phụ thu giao xa nếu > 10km
    }
    return distBase; // Khung giờ nhận hàng
  });

  // Bậc thang hỗ trợ phí ship tự động theo giá trị đơn hàng (Subtotal):
  // Subtotal < 150.000đ: 0đ hỗ trợ (khách trả đủ phí)
  // Subtotal 150.000đ - 299.000đ: Hỗ trợ 10.000đ
  // Subtotal >= 300.000đ: Hỗ trợ tối đa 25.000đ (Freeship)
  readonly autoShippingDiscount = computed<number>(() => {
    if (this.shippingMethod() === 'pickup' || !this.hasDeliveryLocation()) return 0;
    const sub = this.checkoutSubtotal();
    const base = this.baseShippingFee();
    if (sub >= 300000) return Math.min(25000, base);
    if (sub >= 150000) return Math.min(10000, base);
    return 0;
  });

  // Gợi ý tiến trình nhận Freeship
  readonly freeshipProgress = computed(() => {
    const sub = this.checkoutSubtotal();
    if (sub >= 300000) {
      return { qualifiedMax: true, nextGap: 0, text: 'Bạn đã đủ điều kiện nhận Freeship (Hỗ trợ 25.000đ).' };
    }
    if (sub >= 150000) {
      const gap = 300000 - sub;
      return { qualifiedMax: false, nextGap: gap, text: `Mua thêm ${formatPrice(gap)} để nhận Freeship 25.000đ!` };
    }
    const gap1 = 150000 - sub;
    const gap2 = 300000 - sub;
    return { qualifiedMax: false, nextGap: gap1, text: `Mua thêm ${formatPrice(gap1)} để giảm 10.000đ ship, hoặc thêm ${formatPrice(gap2)} để Freeship!` };
  });

  // Giảm giá từ Voucher Freeship (giảm trên số phí ship còn lại sau auto discount)
  readonly shippingVoucherDiscount = computed<number>(() => {
    const sv = this.selectedShippingVoucher();
    if (!sv || this.shippingMethod() === 'pickup' || !this.hasDeliveryLocation()) return 0;
    const remainingFee = Math.max(0, this.baseShippingFee() - this.autoShippingDiscount());
    if (remainingFee <= 0) return 0;
    return Math.min(remainingFee, sv.discount);
  });

  // Phí ship thực trả cuối cùng
  readonly shippingFee = computed<number>(() => {
    if (this.shippingMethod() === 'pickup' || !this.hasDeliveryLocation()) return 0;
    const net = this.baseShippingFee() - this.autoShippingDiscount() - this.shippingVoucherDiscount();
    return Math.max(0, net);
  });

  // Tổng tiền giảm phí vận chuyển (Tự động + Voucher Freeship)
  readonly shippingDiscount = computed<number>(() => {
    if (this.shippingMethod() === 'pickup' || !this.hasDeliveryLocation()) return 0;
    return this.autoShippingDiscount() + this.shippingVoucherDiscount();
  });

  // Phí ship gốc hiển thị gạch ngang
  readonly originalShippingFee = computed<number>(() => {
    if (this.shippingMethod() === 'pickup' || !this.hasDeliveryLocation()) return 0;
    return this.baseShippingFee();
  });

  // Giảm giá từ Voucher Đơn hàng
  readonly orderVoucherDiscount = computed<number>(() => {
    const ov = this.selectedOrderVoucher();
    if (!ov) return 0;
    return Math.min(this.checkoutSubtotal(), ov.discount);
  });

  readonly productDiscount = computed(() => {
    return this.comboDiscount() + this.addonDiscount();
  });

  // Tổng thanh toán: (Tiền hàng - Voucher đơn hàng) + Phí ship thực trả
  readonly finalTotal = computed(() => {
    const goodsAfterVoucher = Math.max(0, this.checkoutSubtotal() - this.orderVoucherDiscount());
    return goodsAfterVoucher + this.shippingFee();
  });

  // Thời gian chuẩn bị hàng + vận chuyển dự kiến (phút)
  // Chuẩn bị: 25p, Tốc độ xe: 22km/h (~2.7p/km), Đệm: 10p
  readonly earliestDeliveryLeadMinutes = computed<number>(() => {
    const prepMinutes = 25;
    const dist = this.shippingDistanceKm() || 4;
    const avgSpeedKmH = 22;
    const travelMinutes = Math.ceil((dist / avgSpeedKmH) * 60);
    const bufferMinutes = 10;
    return prepMinutes + travelMinutes + bufferMinutes;
  });

  // Thông tin Giao ngay 🛵 (Khả dụng từ 07:00 đến 21:15 do cửa hàng hoạt động 07:00 - 22:00)
  readonly instantDeliveryInfo = computed(() => {
    const now = new Date();
    const currentHour = now.getHours() + now.getMinutes() / 60;
    const isOpen = currentHour >= 7.0 && currentHour <= 21.25;

    const arrival = new Date(now.getTime() + 40 * 60 * 1000);
    const hh = String(arrival.getHours()).padStart(2, '0');
    const mm = String(arrival.getMinutes()).padStart(2, '0');

    const origPrice = this.resolvedDistanceBaseFee() + 10000;
    const netPrice = Math.max(0, origPrice - this.autoShippingDiscount() - this.shippingVoucherDiscount());

    return {
      isAvailable: isOpen,
      expectedTimeStr: `${hh}:${mm}`,
      originalPrice: origPrice,
      finalPrice: netPrice,
      isFreeship: netPrice === 0,
      unavailableReason: isOpen ? '' : 'Chỉ nhận giao ngay từ 07:00 đến 21:15',
    };
  });

  // Thông tin Giao tiết kiệm (trong 24h)
  readonly standardDeliveryInfo = computed(() => {
    const orig = 15000 + this.farDeliverySurcharge();
    const net = Math.max(0, orig - this.autoShippingDiscount() - this.shippingVoucherDiscount());
    return {
      originalPrice: orig,
      finalPrice: net,
      isFreeship: net === 0,
    };
  });

  // Đánh giá động danh sách khung giờ nhận hàng (07:00 - 22:00)
  readonly availableTimeSlots = computed<EvaluatedTimeSlot[]>(() => {
    const day = this.selectedDeliveryDay();
    const now = new Date();
    const currentHour = now.getHours() + now.getMinutes() / 60;
    const leadHours = this.earliestDeliveryLeadMinutes() / 60;
    const earliestArrivalHour = currentHour + leadHours;

    const distBase = this.resolvedDistanceBaseFee();
    const netPrice = Math.max(0, distBase - this.autoShippingDiscount() - this.shippingVoucherDiscount());
    const isFreeship = netPrice === 0;

    return BASE_TIME_SLOTS.map(slot => {
      if (day === 'tomorrow') {
        return {
          ...slot,
          originalPrice: distBase,
          finalPrice: netPrice,
          isFreeship,
          isAvailable: true,
        };
      }

      // Hôm nay:
      // Trước 07:00 sáng -> tất cả khung giờ đều kịp
      if (currentHour < 7.0) {
        return {
          ...slot,
          originalPrice: distBase,
          finalPrice: netPrice,
          isFreeship,
          isAvailable: true,
        };
      }

      // Sau 07:00: kiểm tra giờ sớm nhất giao đến có trước giờ kết thúc khung ít nhất 15 phút
      const cutoff = slot.endHour - 0.25;
      const isAvailable = earliestArrivalHour <= cutoff;
      return {
        ...slot,
        originalPrice: distBase,
        finalPrice: netPrice,
        isFreeship,
        isAvailable,
        unavailableReason: isAvailable ? '' : 'Đã qua khung giờ',
      };
    });
  });

  // Kiểm tra hôm nay có còn khung giờ khả dụng không
  readonly hasAvailableSlotsToday = computed<boolean>(() => {
    const now = new Date();
    const currentHour = now.getHours() + now.getMinutes() / 60;
    if (currentHour < 7.0) return true;
    const leadHours = this.earliestDeliveryLeadMinutes() / 60;
    const earliestArrivalHour = currentHour + leadHours;
    return BASE_TIME_SLOTS.some(s => earliestArrivalHour <= (s.endHour - 0.25));
  });

  readonly selectedDeliveryTimeString = computed(() => {
    if (this.shippingMethod() === 'pickup') {
      const store = this.selectedPickupStore();
      return `Đến lấy trực tiếp: ${store.name}`;
    }
    const type = this.selectedDeliveryType();
    if (type === 'instant') {
      const info = this.instantDeliveryInfo();
      return `Giao ngay (30 - 45 phút, dự kiến ${info.expectedTimeStr})`;
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

  readonly estimatedDeliveryTime = computed(() => {
    return this.selectedDeliveryTimeString();
  });

  readonly shippingUnsupported = computed(() => {
    return this.shippingMethod() === 'delivery' && (this.isOutOfRange() || (this.shippingCalculation() !== null && this.shippingCalculation()?.supported === false));
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
          if (!this.shippingAddr()) this.shippingAddr.set(this._formatAddress(def));
          if (!this.confirmedDeliveryProvince() && (def.province || def.city)) {
            this.confirmedDeliveryProvince.set(def.province || def.city || '');
          }
          if (!this.shippingCoordinates() && def.lat && def.lng) {
            this.shippingCoordinates.set({ lat: def.lat, lng: def.lng });
            this.recalculateShipping(def.lat, def.lng);
          }
        }
      }
    });

    // Tự động đặt bộ lọc nhận tại cửa hàng về tỉnh của khách khi có/đổi địa chỉ, vẫn cho phép người dùng tự đổi lại trên dropdown
    effect(() => {
      const hasAddr = this.hasEnteredCustomerAddress();
      const matchedProv = this.customerMatchedPickupProvince();
      const addrKey = hasAddr
        ? `${matchedProv || '__UNSERVED__'}|${this.confirmedDeliveryProvince()}|${this.shippingAddr()}`
        : '';

      if (!hasAddr) {
        if (this.lastAutoScopedAddressKey !== '') {
          this.lastAutoScopedAddressKey = '';
          this.pickupProvinceFilter.set('all');
        }
        return;
      }

      if (addrKey !== this.lastAutoScopedAddressKey) {
        this.lastAutoScopedAddressKey = addrKey;
        this.pickupProvinceFilter.set(matchedProv || '__UNSERVED__');
      }
    });

    // Đồng bộ cửa hàng được chọn theo tỉnh đang lọc để tránh giữ nhầm chi nhánh ngoài danh sách hiển thị
    effect(() => {
      const prov = this.pickupProvinceFilter();
      if (prov === 'all' || prov === '__UNSERVED__') return;
      const storesInProv = this.storeBranches.filter(s => s.province === prov);
      if (storesInProv.length > 0 && !storesInProv.some(s => s.id === this.selectedPickupStoreId())) {
        const coords = this.shippingCoordinates();
        const best = coords
          ? findNearestWarehouse(coords.lat, coords.lng, storesInProv)
          : storesInProv[0];
        if (best?.id) this.selectedPickupStoreId.set(best.id);
      }
    });

    // Tự động đồng bộ mức giảm & điều kiện tối thiểu của voucher khi số lượng/tiền hàng thay đổi
    effect(() => {
      const sub = this.checkoutSubtotal();
      const opts = this.checkoutVoucherOptions();

      const curOrder = this.selectedOrderVoucher();
      if (curOrder) {
        const matched = opts.find(o => o.voucher.code === curOrder.code);
        if (matched && !matched.isEligible) {
          this.selectedOrderVoucher.set(null);
          this.voucherMessage.set(`Mã ${curOrder.code} đã được gỡ vì đơn hàng chưa đạt giá trị tối thiểu.`);
        } else if (matched && matched.estimatedDiscount !== curOrder.discount) {
          this.selectedOrderVoucher.set({ ...curOrder, discount: matched.estimatedDiscount });
        } else if (!matched && (curOrder.voucher?.minValue || 0) > sub) {
          this.selectedOrderVoucher.set(null);
        }
      }

      const curShip = this.selectedShippingVoucher();
      if (curShip && (curShip.voucher?.minValue || 0) > sub) {
        this.selectedShippingVoucher.set(null);
        this.voucherMessage.set(`Mã ${curShip.code} đã được gỡ vì đơn hàng chưa đạt giá trị tối thiểu.`);
      }
    });
  }

  ngOnInit(): void {
    this.route.queryParamMap.subscribe((params) => {
      this.isBuyNowQuery.set(params.get('mode') === 'buynow');
    });

    if (!this.isBuyNowMode() && this.cart.selectedItems().length === 0 && this.cart.items().length > 0) {
      this.cart.selectAll();
    }
    this.voucher.loadPublic();
    this.voucher.refreshMine();
    const qCode = this.route.snapshot.queryParamMap.get('voucher');
    if (qCode) {
      const code = qCode.trim().toUpperCase();
      this.voucherCode.set(code);
      this.pendingQueryVoucher.set(code);
    }

    // Nếu người dùng đã có tọa độ giao hàng lưu trước đó (trong tài khoản hoặc localStorage), tính toán phí ship ban đầu
    const def = this._defaultAddressObj();
    if (def && def.lat && def.lng) {
      this.shippingCoordinates.set({ lat: def.lat, lng: def.lng });
      this.recalculateShipping(def.lat, def.lng);
    } else {
      this.loadSavedLocationFromStorage();
    }

    // Kiểm tra tính khả dụng của các khung giờ hôm nay
    this.ensureValidSelectedTimeSlot();
    this.loadLiveProductStock();
  }

  private ensureValidSelectedTimeSlot(): void {
    if (!this.hasAvailableSlotsToday()) {
      this.selectedDeliveryDay.set('tomorrow');
      this.selectedTimeSlot.set('Từ 07h30 - 09h00');
      return;
    }
    const slots = this.availableTimeSlots();
    const currentValid = slots.some(s => s.label === this.selectedTimeSlot() && s.isAvailable);
    if (!currentValid) {
      const firstAvail = slots.find(s => s.isAvailable);
      if (firstAvail) {
        this.selectedTimeSlot.set(firstAvail.label);
      }
    }
  }

  private loadSavedLocationFromStorage(): void {
    try {
      const raw = localStorage.getItem(this.LAST_LOCATION_STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw);
      if (parsed && typeof parsed.address === 'string' && parsed.address.trim() && typeof parsed.lat === 'number' && typeof parsed.lng === 'number') {
        if (!this.shippingAddr()) this.shippingAddr.set(parsed.address.trim());
        if (!this.confirmedDeliveryProvince() && typeof parsed.province === 'string' && parsed.province.trim()) {
          this.confirmedDeliveryProvince.set(parsed.province.trim());
        }
        if (!this.shippingCoordinates()) {
          this.shippingCoordinates.set({ lat: parsed.lat, lng: parsed.lng });
          const nearest = findNearestWarehouse(parsed.lat, parsed.lng, DEFAULT_WAREHOUSES);
          if (nearest?.id) this.selectedPickupStoreId.set(nearest.id);
          this.recalculateShipping(parsed.lat, parsed.lng);
        }
      }
    } catch {
      // ignore invalid storage
    }
  }

  private saveLocationToStorage(address: string, lat: number, lng: number, province = ''): void {
    try {
      localStorage.setItem(this.LAST_LOCATION_STORAGE_KEY, JSON.stringify({ address, lat, lng, province }));
    } catch {
      // ignore storage quota errors
    }
  }

  ngOnDestroy(): void {
    this.stopQrTimers();
  }

  /** Lấy thông tin đối tượng địa chỉ mặc định của người dùng */
  protected _defaultAddressObj(): XanhLaAddress | null {
    const addrs = this.cart.currentUser()?.addresses ?? [];
    return addrs.find((x) => x.isDefault) ?? addrs[0] ?? null;
  }

  private _formatAddress(a: XanhLaAddress | null): string {
    if (!a) return '';
    if (a.address && a.city && a.address.toLowerCase().includes(a.city.toLowerCase())) {
      return a.address;
    }
    return [a.address, a.city].filter(Boolean).join(', ');
  }

  /** Chuỗi địa chỉ mặc định của tài khoản đang đăng nhập */
  private _defaultAddress(): string {
    return this._formatAddress(this._defaultAddressObj());
  }

  // ── Khuyến mãi kép: Xử lý chọn / hủy Voucher Đơn Hàng & Voucher Freeship ──

  selectOrderVoucher(code: string): void {
    if (this.selectedOrderVoucher()?.code === code) {
      this.removeOrderVoucher();
      return;
    }
    const opt = this.orderVoucherOptions().find(o => o.voucher.code === code);
    if (!opt || !opt.isEligible) return;

    this.voucher.validateVoucher(code, this.checkoutSubtotal()).subscribe((res) => {
      if (res.valid) {
        this.selectedOrderVoucher.set({
          code,
          discount: res.discount,
          voucher: opt.voucher,
        });
        this.voucherMessage.set(`Đã áp dụng mã đơn hàng ${code}: -${formatPrice(res.discount)}`);
      } else {
        this.voucherMessage.set(res.message || 'Mã không hợp lệ');
      }
    });
  }

  removeOrderVoucher(): void {
    this.selectedOrderVoucher.set(null);
    this.voucherMessage.set('');
  }

  selectShippingVoucher(code: string): void {
    if (this.selectedShippingVoucher()?.code === code) {
      this.removeShippingVoucher();
      return;
    }
    const opt = this.shippingVoucherOptions().find(o => o.voucher.code === code);
    if (!opt || !opt.isEligible) return;

    this.voucher.validateVoucher(code, this.checkoutSubtotal()).subscribe((res) => {
      if (res.valid) {
        this.selectedShippingVoucher.set({
          code,
          discount: res.discount || opt.voucher.value || 30000,
          voucher: opt.voucher,
        });
        this.voucherMessage.set(`Đã áp dụng mã Freeship ${code}`);
      } else {
        this.voucherMessage.set(res.message || 'Mã không hợp lệ');
      }
    });
  }

  removeShippingVoucher(): void {
    this.selectedShippingVoucher.set(null);
    this.voucherMessage.set('');
  }

  selectOfferCode(code: string): void {
    const isShip = this.shippingVoucherOptions().some(o => o.voucher.code === code);
    if (isShip) {
      this.selectShippingVoucher(code);
    } else {
      this.selectOrderVoucher(code);
    }
  }

  applyVoucher(): void {
    const code = this.voucherCode().trim().toUpperCase();
    if (!code) {
      this.voucherMessage.set('Vui lòng nhập hoặc dán mã voucher');
      return;
    }
    this.voucherCode.set(code);

    this.voucher.validateVoucher(code, this.checkoutSubtotal()).subscribe((result) => {
      if (result.valid) {
        const allVouchers = [
          ...this.voucher.availableVouchers().map(uv => uv.voucher),
          ...this.voucher.publicVouchers()
        ];
        const matched = allVouchers.find(v => v.code.toUpperCase() === code);
        const isShip = matched ? this.isShippingVoucher(matched) : (code.includes('FREESHIP') || code.includes('SHIP'));

        if (isShip) {
          const discountVal = result.discount || matched?.value || 30000;
          this.selectedShippingVoucher.set({
            code,
            discount: discountVal,
            voucher: matched || ({ code, name: 'Voucher Miễn Phí Vận Chuyển', type: 'fixed', value: discountVal } as any)
          });
          this.voucherMessage.set(`Đã áp dụng mã Freeship ${code}`);
        } else {
          this.selectedOrderVoucher.set({
            code,
            discount: result.discount,
            voucher: matched || ({ code, name: 'Voucher Giảm Giá', type: 'percentage', value: result.discount } as any)
          });
          this.voucherMessage.set(`Đã áp dụng mã giảm đơn hàng ${code}: -${formatPrice(result.discount)}`);
        }
      } else {
        this.voucherMessage.set(result.message || 'Mã voucher không hợp lệ');
      }
    });
  }

  removeVoucher(): void {
    this.removeOrderVoucher();
    this.removeShippingVoucher();
    this.voucherCode.set('');
    this.voucherMessage.set('');
  }

  // ── Mở / Đóng modal địa chỉ Bách Hoá XANH ────────────────────────
  openAddressModal(): void {
    this.showAddressModal.set(true);
  }

  closeAddressModal(): void {
    this.showAddressModal.set(false);
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

  /** Áp dụng địa chỉ & tọa độ đã xác nhận, lưu localStorage và tính phí ship OSRM */
  private applyConfirmedLocation(finalAddr: string, lat: number, lng: number, provinceName = ''): void {
    this.shippingAddr.set(finalAddr);
    this.confirmedDeliveryProvince.set(provinceName);
    this.shippingCoordinates.set({ lat, lng });
    this.saveLocationToStorage(finalAddr, lat, lng, provinceName);

    const nearest = findNearestWarehouse(lat, lng, DEFAULT_WAREHOUSES);
    if (nearest?.id) {
      this.selectedPickupStoreId.set(nearest.id);
    }

    this.recalculateShipping(lat, lng);
  }

  onCheckoutAddressConfirmed(res: AddressPickerResult): void {
    if (res.otherReceiverChecked) {
      if (res.receiverName) this.guestName.set(res.receiverName);
      if (res.receiverPhone) this.guestPhone.set(res.receiverPhone);
    }

    const provinceHint = res.isGps ? '' : res.provinceName;
    this.applyConfirmedLocation(res.fullAddress, res.lat, res.lng, provinceHint);

    if (this.cart.currentUser()) {
      this.cart.addAddress({
        id: 'addr_' + Date.now(),
        label: res.label || 'Địa chỉ nhận hàng',
        address: res.fullAddress,
        city: res.provinceName,
        province: res.provinceName,
        provinceCode: res.provinceCode,
        ward: res.wardName,
        wardCode: res.wardCode,
        street: res.street,
        lat: res.lat,
        lng: res.lng,
        fullName: res.receiverName,
        phone: res.receiverPhone,
        isDefault: true,
      });
    }

    this.closeAddressModal();
  }

  recalculateShipping(lat: number, lng: number): void {
    this.isCalculatingShipping.set(true);
    this.shippingApi.calculate(lat, lng, this.checkoutSubtotal()).subscribe({
      next: (res) => {
        this.isCalculatingShipping.set(false);
        if (res.success && res.data) {
          this.shippingCalculation.set(res.data);
          if (res.data.warehouse?.id) {
            this.selectedPickupStoreId.set(res.data.warehouse.id);
          }
          if (!res.data.supported) {
            this.isOutOfRange.set(true);
            this.outOfRangeMessage.set(res.data.message || 'Khu vực giao hàng vượt quá bán kính 20km cho phép.');
          } else {
            this.isOutOfRange.set(false);
            this.outOfRangeMessage.set('');
          }
          this.ensureValidSelectedTimeSlot();
        }
      },
      error: (err) => {
        this.isCalculatingShipping.set(false);
        console.error('Lỗi tính phí giao hàng:', err);
      }
    });
  }

  selectPickupStore(store: StoreBranch): void {
    this.selectedPickupStoreId.set(store.id || 'store-thuduc');
  }

  // Chuyển nhanh sang "Nhận tại cửa hàng" gần nhất để miễn phí ship
  switchToPickupAtNearestStore(): void {
    const wh = this.nearestWarehouse() || DEFAULT_WAREHOUSES[0];
    this.selectedPickupStoreId.set(wh.id || 'store-thuduc');
    if (wh.province) {
      this.pickupProvinceFilter.set(wh.province);
    }
    this.pickupSearchQuery.set('');
    this.shippingMethod.set('pickup');
    this.errorMsg.set('');
  }

  toggleDeliveryTime(): void {
    this.deliveryTimeExpanded.set(!this.deliveryTimeExpanded());
  }

  setDeliveryType(type: 'instant' | 'standard' | 'timeslot'): void {
    if (type === 'instant' && !this.instantDeliveryInfo().isAvailable) {
      return;
    }
    this.selectedDeliveryType.set(type);
  }

  setDeliveryDay(day: 'today' | 'tomorrow'): void {
    this.selectedDeliveryDay.set(day);
    this.selectedDeliveryType.set('timeslot');
    // Đảm bảo khung giờ được chọn khả dụng
    const slots = this.availableTimeSlots();
    const current = this.selectedTimeSlot();
    const found = slots.find(s => s.label === current && s.isAvailable);
    if (!found) {
      const firstAvail = slots.find(s => s.isAvailable);
      if (firstAvail) {
        this.selectedTimeSlot.set(firstAvail.label);
      }
    }
  }

  setTimeSlot(slot: string): void {
    const slots = this.availableTimeSlots();
    const matched = slots.find(s => s.label === slot);
    if (matched && !matched.isAvailable) return;
    this.selectedTimeSlot.set(slot);
    this.selectedDeliveryType.set('timeslot');
  }

  handleSubmit(e: Event): void {
    e.preventDefault();
    this.submitAttempted.set(true);

    const currentItems = this.checkoutItems();
    if (currentItems.length === 0) {
      this.errorMsg.set('Không có sản phẩm nào được chọn để thanh toán.');
      return;
    }
    const stockCheck = this.checkoutStockCheck();
    if (stockCheck.hasIssues) {
      this.errorMsg.set(stockCheck.firstError);
      this.scrollToTop();
      return;
    }
    if (!this.guestName()?.trim()) {
      this.errorMsg.set('Vui lòng điền họ và tên người nhận.');
      this.focusField('contact-name');
      return;
    }
    if (!this.guestPhone()?.trim()) {
      this.errorMsg.set('Vui lòng điền số điện thoại liên hệ.');
      this.focusField('contact-phone');
      return;
    }
    if (!this.guestEmail()?.trim()) {
      this.errorMsg.set('Vui lòng điền địa chỉ email nhận thông tin đơn hàng.');
      this.focusField('contact-email');
      return;
    }
    if (this.shippingMethod() === 'delivery' && !this.shippingAddr()) {
      this.errorMsg.set('Vui lòng thêm thông tin nhận hàng trước khi thanh toán.');
      this.openAddressModal();
      return;
    }

    if (this.shippingMethod() === 'delivery' && this.isOutOfRange()) {
      this.errorMsg.set(
        this.outOfRangeMessage() ||
          'Khu vực giao hàng vượt quá bán kính 20km cho phép đối với nông sản & thực phẩm mát. Vui lòng chọn điểm nhận hàng gần hơn hoặc chọn "Nhận tại cửa hàng".'
      );
      this.scrollToTop();
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

  focusField(id: string): void {
    setTimeout(() => {
      const el = document.getElementById(id);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.focus();
        el.classList.add('input-shake-error');
        setTimeout(() => el.classList.remove('input-shake-error'), 800);
      } else {
        this.scrollToFirstError();
      }
    }, 50);
  }

  scrollToFirstError(): void {
    const target = document.getElementById('section-contact-info') || document.querySelector('form');
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      const firstInput = target.querySelector('input') as HTMLInputElement | null;
      if (firstInput) {
        firstInput.focus();
        firstInput.classList.add('input-shake-error');
        setTimeout(() => firstInput.classList.remove('input-shake-error'), 800);
      }
    } else {
      window.scrollTo({ top: 120, behavior: 'smooth' });
    }
  }

  scrollToTop(top = 120): void {
    if (typeof window === 'undefined') return;
    requestAnimationFrame(() => {
      window.scrollTo({ top, left: 0, behavior: top === 0 ? 'auto' : 'smooth' });
      if (top === 0) {
        document.documentElement.scrollTop = 0;
      }
    });
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
      const live = this.findLiveProduct(i);
      const isCombo = Boolean(
        prod.isCombo || i.isCombo || i.itemType === 'combo' ||
        live?.isCombo || (Array.isArray(prod.comboItems) && prod.comboItems.length > 0)
      );
      // id có dạng 24-char hex (MongoDB ObjectId)
      const isObjectId = /^[a-f\d]{24}$/i.test(prod.id ?? '');
      const itemType = isCombo
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
        isCombo,
        itemType,
        linkedMainProduct: itemType === 'addon' ? (i.linkedMainProductId || i.linkedMainProductSlug || '') : '',
        comboItems:        (prod.comboItems && prod.comboItems.length > 0) ? prod.comboItems : (live?.comboItems || []),
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
      discount:            this.orderVoucherDiscount(),
      voucherCode:         this.selectedOrderVoucher()?.code || null,
      shippingVoucherCode: this.selectedShippingVoucher()?.code || null,
      shippingVoucherDiscount: this.shippingVoucherDiscount(),
      shippingFee:         this.shippingFee(),
      shippingDiscount:    this.shippingDiscount(),
      shippingDistanceKm:  this.shippingCalculation()?.distanceKm || this.shippingDistanceKm() || 0,
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
        this.guestOrderSubmitted.set(!this.cart.currentUser());
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

        if (this.paymentMethod() === 'bank_transfer') {
          const pStatus = (res.data?.paymentStatus || res.paymentStatus || 'unpaid') as 'unpaid' | 'paid' | 'expired';
          const rawExp = res.data?.paymentExpiresAt || res.paymentExpiresAt;
          const expiresDate = rawExp ? new Date(rawExp) : new Date(Date.now() + 15 * 60 * 1000);
          this.qrPaymentStatus.set(pStatus);
          this.qrExpiresAt.set(expiresDate);
          this.qrPaidAt.set(null);
          this.qrStatusNote.set('');
          this.completed.set(true);
          this.updateQrCountdownText();
          this.scrollToTop(0);

          if (pStatus === 'paid') {
            this.finalizePaidQrOrder();
          } else if (pStatus === 'unpaid') {
            this.startQrTimers();
          }
          return;
        }

        // Luồng COD: hoàn tất ngay
        this.completed.set(true);
        this.scrollToTop(0);
        this.cart.loadUserData();
        this.voucher.refreshMine();
        if (this.isBuyNowMode()) {
          this.cart.clearBuyNowSession();
        } else {
          this.cart.removeSelectedItems();
        }
      },
      error: (err) => {
        this.submitting.set(false);
        this.errorMsg.set(err.error?.message || 'Đặt hàng thất bại, vui lòng thử lại.');
        this.loadLiveProductStock();
      },
    });
  }

  private stopQrTimers(): void {
    if (this.qrPollTimer) {
      clearInterval(this.qrPollTimer);
      this.qrPollTimer = null;
    }
    if (this.qrCountdownTimer) {
      clearInterval(this.qrCountdownTimer);
      this.qrCountdownTimer = null;
    }
  }

  private updateQrCountdownText(): void {
    const exp = this.qrExpiresAt();
    if (!exp) {
      this.qrCountdownText.set('15:00');
      return;
    }
    const diffSec = Math.max(0, Math.floor((exp.getTime() - Date.now()) / 1000));
    const mm = String(Math.floor(diffSec / 60)).padStart(2, '0');
    const ss = String(diffSec % 60).padStart(2, '0');
    this.qrCountdownText.set(`${mm}:${ss}`);
    if (diffSec === 0 && this.qrPaymentStatus() === 'unpaid') {
      this.checkQrPaymentStatusOnce(false);
    }
  }

  private startQrTimers(): void {
    this.stopQrTimers();
    this.qrCountdownTimer = setInterval(() => this.updateQrCountdownText(), 1000);
    this.qrPollTimer = setInterval(() => this.checkQrPaymentStatusOnce(false), 3000);
  }

  private finalizePaidQrOrder(paidAt?: string | null): void {
    this.stopQrTimers();
    this.qrPaymentStatus.set('paid');
    this.qrPaidAt.set(paidAt || new Date().toISOString());
    this.qrStatusNote.set('');
    this.scrollToTop(0);
    this.cart.loadUserData();
    this.voucher.refreshMine();
    if (this.isBuyNowMode()) {
      this.cart.clearBuyNowSession();
    } else {
      this.cart.removeSelectedItems();
    }
  }

  private handleQrStatusSnapshot(
    d: { paymentStatus?: string; status?: string; paidAt?: string | null },
    manualTrigger: boolean
  ): void {
    const isPaid =
      d.paymentStatus === 'paid' ||
      (d.status !== undefined && ['confirmed', 'preparing', 'shipping', 'delivered'].includes(d.status));
    if (isPaid) {
      this.finalizePaidQrOrder(d.paidAt);
    } else if (d.paymentStatus === 'expired' || d.status === 'cancelled') {
      this.stopQrTimers();
      this.qrPaymentStatus.set('expired');
      this.loadLiveProductStock();
    } else if (manualTrigger) {
      this.qrStatusNote.set('Chưa ghi nhận chuyển khoản mới. Vui lòng đợi Admin hoặc ngân hàng xác nhận rồi kiểm tra lại.');
    }
  }

  private checkQrPaymentStatusOnce(manualTrigger: boolean): void {
    const code = this.orderCode();
    if (!code || this.qrPaymentStatus() !== 'unpaid') return;
    if (manualTrigger) {
      this.qrChecking.set(true);
      this.qrStatusNote.set('');
    }
    this.orderApi.getPaymentStatus(code).subscribe({
      next: (res) => {
        if (manualTrigger) this.qrChecking.set(false);
        if (res?.data) this.handleQrStatusSnapshot(res.data, manualTrigger);
      },
      error: () => {
        this.orderApi.track(code).subscribe({
          next: (trackRes) => {
            if (manualTrigger) this.qrChecking.set(false);
            if (trackRes?.data) {
              this.handleQrStatusSnapshot(trackRes.data, manualTrigger);
            } else if (manualTrigger) {
              this.qrStatusNote.set('Chưa ghi nhận chuyển khoản mới. Vui lòng thử kiểm tra lại sau vài giây.');
            }
          },
          error: () => {
            if (manualTrigger) {
              this.qrChecking.set(false);
              this.qrStatusNote.set('Chưa ghi nhận chuyển khoản mới. Vui lòng thử kiểm tra lại sau vài giây.');
            }
          },
        });
      },
    });
  }

  checkQrPaymentStatusNow(): void {
    this.checkQrPaymentStatusOnce(true);
  }

  cancelPendingQrOrder(): void {
    const code = this.orderCode();
    if (!code || this.qrCancelling()) return;
    this.qrCancelling.set(true);
    this.orderApi.cancel(code, 'Khách hàng hủy chờ thanh toán VietQR để chọn lại').subscribe({
      next: () => {
        this.qrCancelling.set(false);
        this.resetExpiredQrToCheckout();
      },
      error: () => {
        this.qrCancelling.set(false);
        this.resetExpiredQrToCheckout();
      },
    });
  }

  resetExpiredQrToCheckout(): void {
    this.stopQrTimers();
    this.completed.set(false);
    this.nonRefundableConfirmed.set(false);
    this.qrPaymentStatus.set('unpaid');
    this.qrUrl.set(null);
    this.orderCode.set('');
    this.qrStatusNote.set('');
    this.loadLiveProductStock();
    this.scrollToTop(0);
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

  openGuestAuth(tab: 'login' | 'signup'): void {
    this.cart.openAuthModal(
      tab,
      tab === 'signup'
        ? {
            name: this.guestName().trim(),
            phone: this.guestPhone().trim(),
          }
        : undefined
    );
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
