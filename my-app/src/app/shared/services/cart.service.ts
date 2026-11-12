import { Injectable, signal, computed, inject } from '@angular/core';
import {
  XanhLaProduct,
  XanhLaCartItem,
  XanhLaUser,
  XanhLaAddress,
  ViewedProductItem,
  EvaluatedCartItemPricing,
} from '../models/xanh-la.models';
import { ApiService } from './api.service';
import { animateFlyToCart } from '../utils/fly-to-cart.util';

const USER_KEY         = 'xanhla_user_session';
const TOKEN_KEY        = 'xanhla_auth_token';
const SELECTED_KEY     = 'xanhla_selected_keys';
const GUEST_VIEWED_KEY = 'xanhla_guest_viewed_products';

// Key giỏ hàng riêng theo từng user
function cartKey(ident: string): string {
  return `xanhla_cart__${ident || 'guest'}`;
}

export function cartItemKey(
  slug: string,
  selectedOption?: string,
  itemType?: 'regular' | 'combo' | 'addon',
  linkedMainId?: string
): string {
  if (itemType === 'addon' && linkedMainId) {
    return `${slug}|${selectedOption ?? ''}|addon:${linkedMainId}`;
  }
  return `${slug}|${selectedOption ?? ''}`;
}

export function getCartItemKey(item: XanhLaCartItem): string {
  return cartItemKey(
    item.product.slug,
    item.selectedOption,
    item.itemType,
    item.linkedMainProductId
  );
}

export function resolveProductOption(
  product: Pick<XanhLaProduct, 'options'> | undefined | null,
  option?: string | null
): string | undefined {
  if (!product || !Array.isArray(product.options) || product.options.length === 0) {
    return undefined;
  }
  const trimmed = option?.trim();
  return trimmed || undefined;
}

export interface CartPricingTotals {
  originalSubtotal: number;
  subtotal: number;
  comboDiscount: number;
  addonDiscount: number;
  totalSavings: number;
}

export function aggregatePricingTotals(pricingMap: Map<string, EvaluatedCartItemPricing>): CartPricingTotals {
  let originalSubtotal = 0;
  let subtotal = 0;
  let comboDiscount = 0;
  let addonDiscount = 0;
  for (const p of pricingMap.values()) {
    originalSubtotal += p.lineOriginalTotal;
    subtotal += p.linePayableTotal;
    comboDiscount += p.comboSaving;
    addonDiscount += p.addonSaving;
  }
  return {
    originalSubtotal,
    subtotal,
    comboDiscount,
    addonDiscount,
    totalSavings: comboDiscount + addonDiscount,
  };
}

export function buildAddonCartItem(
  ao: {
    product: XanhLaProduct;
    discountType: 'percent' | 'fixed';
    discountValue: number;
    quantity?: number;
  },
  mainProduct: XanhLaProduct,
  fallbackQty = 1
): XanhLaCartItem {
  const mainId = mainProduct.id || mainProduct.slug;
  const aoQty = Math.max(1, Math.round(ao.quantity ?? fallbackQty));
  return {
    product: ao.product,
    quantity: aoQty,
    selectedOption: '',
    itemType: 'addon',
    linkedMainProductId: mainId,
    linkedMainProductSlug: mainProduct.slug,
    linkedMainProductName: mainProduct.name,
    addonDiscountType: ao.discountType,
    addonDiscountValue: ao.discountValue,
  };
}

export type AuthTab = 'login' | 'signup' | 'forgot';

export interface AuthModalPrefill {
  name?: string;
  phone?: string;
}

function priceValue(price: string): number {
  return Number((price || '').replace(/[^\d]/g, ''));
}

export function unitPriceOf(product: Pick<XanhLaProduct, 'price' | 'priceNumber'>): number {
  if (typeof product.priceNumber === 'number' && !Number.isNaN(product.priceNumber) && product.priceNumber > 0) {
    return product.priceNumber;
  }
  return priceValue(product.price);
}

export function calcAddOnUnitDiscount(
  targetUnitPrice: number,
  discountType?: 'percent' | 'fixed' | string,
  discountValue?: number
): number {
  const val = Number(discountValue) || 0;
  if (val <= 0 || targetUnitPrice <= 0) return 0;
  const rawDisc = discountType === 'fixed'
    ? Math.round(val)
    : Math.round((targetUnitPrice * Math.min(99, val)) / 100);
  return Math.max(0, Math.min(targetUnitPrice, rawDisc));
}

export function formatPrice(value: number): string {
  return value.toLocaleString('vi-VN') + 'đ';
}

export function resolveProductMaxStock(
  product?: Pick<XanhLaProduct, 'stock' | 'availableStock' | 'isCombo' | 'comboStatus'> | null
): number | null {
  if (!product) return null;
  if (product.comboStatus === 'paused' || product.comboStatus === 'hidden') return 0;
  const raw = typeof product.availableStock === 'number'
    ? product.availableStock
    : (typeof product.stock === 'number' ? product.stock : null);
  return raw !== null && Number.isFinite(raw) ? Math.max(0, Math.floor(raw)) : null;
}

export function isComboProduct(
  product?: Pick<XanhLaProduct, 'isCombo' | 'comboItems'> | null
): boolean {
  return Boolean(product && (product.isCombo || (Array.isArray(product.comboItems) && product.comboItems.length > 0)));
}

export function evaluateItemsPricingMap(items: XanhLaCartItem[]): Map<string, EvaluatedCartItemPricing> {
  const map = new Map<string, EvaluatedCartItemPricing>();
  const regularItems: XanhLaCartItem[] = [];
  const addonItems: XanhLaCartItem[] = [];

  for (const it of items) {
    const key = getCartItemKey(it);
    const basePrice = unitPriceOf(it.product);
    if (isComboProduct(it.product) || it.isCombo || it.itemType === 'combo') {
      const origUnit = it.product.originalPriceNumber && it.product.originalPriceNumber > basePrice
        ? it.product.originalPriceNumber
        : basePrice;
      const comboSaving = Math.max(0, (origUnit - basePrice) * it.quantity);
      map.set(key, {
        key,
        itemType: 'combo',
        originalUnitPrice: origUnit,
        effectiveUnitPrice: basePrice,
        lineOriginalTotal: origUnit * it.quantity,
        linePayableTotal: basePrice * it.quantity,
        lineSaving: comboSaving,
        comboSaving,
        addonSaving: 0,
        discountedByAddon: false,
        discountedQty: 0,
        isAddonActive: false,
        missingMainWarning: '',
        promoBadge: 'Combo tiết kiệm',
        relationLabel: '',
      });
    } else if (it.itemType === 'addon' && (it.linkedMainProductId || it.linkedMainProductSlug)) {
      addonItems.push(it);
    } else {
      regularItems.push(it);
    }
  }

  // Map sản phẩm chính mua lẻ có mặt trong tập đánh giá
  const mainProdByKey = new Map<string, XanhLaProduct>();
  const mainRegularQty = new Map<string, number>();
  for (const reg of regularItems) {
    const pid = reg.product.id || reg.product.slug;
    mainProdByKey.set(pid, reg.product);
    if (reg.product.slug) mainProdByKey.set(reg.product.slug, reg.product);
    mainRegularQty.set(pid, (mainRegularQty.get(pid) || 0) + reg.quantity);
  }

  const unclaimedMainUnits = new Map<string, number>(mainRegularQty);
  const pairQuotaRemaining = new Map<string, number>();
  const mainDiscountsAllocated = new Map<string, { qty: number; unitDisc: number; addonName: string }[]>();

  interface ResolvedAddon {
    item: XanhLaCartItem;
    key: string;
    addonPrice: number;
    valid: boolean;
    missingReason: string;
    mainProd?: XanhLaProduct;
    mainId?: string;
    mainPrice?: number;
    discountType?: 'percent' | 'fixed';
    discountValue?: number;
    discountTarget?: 'addon' | 'main';
    potentialUnitDisc?: number;
  }

  const resolvedAddons: ResolvedAddon[] = addonItems.map((it) => {
    const key = getCartItemKey(it);
    const addonPrice = unitPriceOf(it.product);
    const lookupKey = it.linkedMainProductId || it.linkedMainProductSlug || '';
    const mainProd = mainProdByKey.get(lookupKey);

    if (!mainProd) {
      return {
        item: it,
        key,
        addonPrice,
        valid: false,
        missingReason: `Chọn mua cùng "${it.linkedMainProductName || 'sản phẩm chính'}" để được áp dụng giá Mua kèm`,
      };
    }

    const mainId = mainProd.id || mainProd.slug;
    const addonId = it.product.id || it.product.slug;
    if (mainId === addonId) {
      return { item: it, key, addonPrice, valid: false, missingReason: '' };
    }

    // Ưu tiên cấu hình trực tiếp trên mainProd nếu có, dự phòng sang snapshot trên cart item
    let discountType: 'percent' | 'fixed' | undefined = it.addonDiscountType;
    let discountValue: number | undefined = it.addonDiscountValue;
    if (Array.isArray(mainProd.addOnDeals) && mainProd.addOnDeals.length > 0) {
      const liveDeal = mainProd.addOnDeals.find((d) => {
        const dp = d?.product;
        const dpId = dp ? (dp._id || (dp as any).id || '') : '';
        const dpSlug = dp ? (dp.slug || '') : '';
        return (dpId && dpId === addonId) || (dpSlug && dpSlug === it.product.slug);
      });
      if (!liveDeal || liveDeal.isActive === false || Number(liveDeal.discountValue) <= 0) {
        return {
          item: it,
          key,
          addonPrice,
          valid: false,
          missingReason: 'Ưu đãi mua kèm hiện không còn hiệu lực, tính theo giá bán lẻ',
        };
      }
      discountType = liveDeal.discountType;
      discountValue = liveDeal.discountValue;
    }

    const mainPrice = unitPriceOf(mainProd);
    const discountTarget: 'addon' | 'main' = addonPrice <= mainPrice ? 'addon' : 'main';
    const potentialUnitDisc = discountTarget === 'addon'
      ? calcAddOnUnitDiscount(addonPrice, discountType, discountValue)
      : calcAddOnUnitDiscount(mainPrice, discountType, discountValue);

    if (potentialUnitDisc <= 0) {
      return { item: it, key, addonPrice, valid: false, missingReason: '' };
    }

    return {
      item: it,
      key,
      addonPrice,
      valid: true,
      missingReason: '',
      mainProd,
      mainId,
      mainPrice,
      discountType,
      discountValue,
      discountTarget,
      potentialUnitDisc,
    };
  });

  resolvedAddons.sort((a, b) => {
    if (a.discountTarget === 'main' && b.discountTarget === 'main') {
      return (b.potentialUnitDisc || 0) - (a.potentialUnitDisc || 0);
    }
    return 0;
  });

  for (const ra of resolvedAddons) {
    const it = ra.item;
    if (!ra.valid || !ra.mainProd || !ra.mainId) {
      map.set(ra.key, {
        key: ra.key,
        itemType: 'addon',
        originalUnitPrice: ra.addonPrice,
        effectiveUnitPrice: ra.addonPrice,
        lineOriginalTotal: ra.addonPrice * it.quantity,
        linePayableTotal: ra.addonPrice * it.quantity,
        lineSaving: 0,
        comboSaving: 0,
        addonSaving: 0,
        discountedByAddon: false,
        discountedQty: 0,
        isAddonActive: false,
        missingMainWarning: ra.missingReason,
        promoBadge: 'Mua kèm',
        relationLabel: it.linkedMainProductName ? `Mua kèm với: ${it.linkedMainProductName}` : '',
      });
      continue;
    }

    const addonId = it.product.id || it.product.slug;
    const pairKey = `${ra.mainId}:${addonId}`;
    const maxQuota = pairQuotaRemaining.has(pairKey)
      ? pairQuotaRemaining.get(pairKey)!
      : (mainRegularQty.get(ra.mainId) || 0);

    if (ra.discountTarget === 'addon') {
      const pairedQty = Math.min(it.quantity, maxQuota);
      pairQuotaRemaining.set(pairKey, maxQuota - pairedQty);
      const unitDisc = ra.potentialUnitDisc || 0;
      const saving = unitDisc * pairedQty;
      const lineOrig = ra.addonPrice * it.quantity;
      const linePayable = lineOrig - saving;
      const effUnit = it.quantity > 0 ? Math.round(linePayable / it.quantity) : ra.addonPrice;

      map.set(ra.key, {
        key: ra.key,
        itemType: 'addon',
        originalUnitPrice: ra.addonPrice,
        effectiveUnitPrice: effUnit,
        lineOriginalTotal: lineOrig,
        linePayableTotal: linePayable,
        lineSaving: saving,
        comboSaving: 0,
        addonSaving: saving,
        discountedByAddon: saving > 0,
        discountedQty: pairedQty,
        isAddonActive: pairedQty > 0,
        missingMainWarning:
          it.quantity > pairedQty
            ? `${pairedQty} SP hưởng ưu đãi mua kèm, ${it.quantity - pairedQty} SP vượt số lượng SP chính tính giá lẻ`
            : '',
        promoBadge: 'Mua kèm tiết kiệm',
        relationLabel: `Mua kèm cùng: ${ra.mainProd.name}`,
      });
    } else {
      // ra.discountTarget === 'main'
      const availMain = unclaimedMainUnits.get(ra.mainId) || 0;
      const pairedQty = Math.min(it.quantity, maxQuota, availMain);
      pairQuotaRemaining.set(pairKey, maxQuota - pairedQty);
      const unitDiscOnMain = ra.potentialUnitDisc || 0;

      if (pairedQty > 0 && unitDiscOnMain > 0) {
        unclaimedMainUnits.set(ra.mainId, availMain - pairedQty);
        const list = mainDiscountsAllocated.get(ra.mainId) || [];
        list.push({
          qty: pairedQty,
          unitDisc: unitDiscOnMain,
          addonName: it.product.name,
        });
        mainDiscountsAllocated.set(ra.mainId, list);
      }

      const lineOrig = ra.addonPrice * it.quantity;
      map.set(ra.key, {
        key: ra.key,
        itemType: 'addon',
        originalUnitPrice: ra.addonPrice,
        effectiveUnitPrice: ra.addonPrice,
        lineOriginalTotal: lineOrig,
        linePayableTotal: lineOrig,
        lineSaving: 0,
        comboSaving: 0,
        addonSaving: 0,
        discountedByAddon: false,
        discountedQty: 0,
        isAddonActive: pairedQty > 0,
        missingMainWarning:
          pairedQty === 0
            ? 'Đã dùng hết lượt giảm trên sản phẩm chính, SP mua kèm tính giá lẻ'
            : '',
        promoBadge: 'Mua kèm tiết kiệm',
        relationLabel:
          pairedQty > 0
            ? `Mua kèm cùng: ${ra.mainProd.name} (ưu đãi giảm trên "${ra.mainProd.name}" vì có giá thấp hơn)`
            : `Mua kèm cùng: ${ra.mainProd.name}`,
      });
    }
  }

  for (const reg of regularItems) {
    const key = getCartItemKey(reg);
    const pid = reg.product.id || reg.product.slug;
    const basePrice = unitPriceOf(reg.product);
    let remQty = reg.quantity;
    let totalSaving = 0;
    let discountedQty = 0;
    const addonNames: string[] = [];
    const allocList = mainDiscountsAllocated.get(pid) || [];

    for (const alloc of allocList) {
      if (remQty <= 0) break;
      if (alloc.qty <= 0) continue;
      const take = Math.min(remQty, alloc.qty);
      alloc.qty -= take;
      remQty -= take;
      totalSaving += alloc.unitDisc * take;
      discountedQty += take;
      if (!addonNames.includes(alloc.addonName)) {
        addonNames.push(alloc.addonName);
      }
    }

    const lineOrig = basePrice * reg.quantity;
    const linePayable = Math.max(0, lineOrig - totalSaving);
    const effUnit = reg.quantity > 0 ? Math.round(linePayable / reg.quantity) : basePrice;

    map.set(key, {
      key,
      itemType: 'regular',
      originalUnitPrice: basePrice,
      effectiveUnitPrice: effUnit,
      lineOriginalTotal: lineOrig,
      linePayableTotal: linePayable,
      lineSaving: totalSaving,
      comboSaving: 0,
      addonSaving: totalSaving,
      discountedByAddon: totalSaving > 0,
      discountedQty,
      isAddonActive: totalSaving > 0,
      missingMainWarning: '',
      promoBadge: totalSaving > 0 ? 'Giảm nhờ Mua kèm' : 'Sản phẩm mua lẻ',
      relationLabel:
        totalSaving > 0
          ? `Áp dụng ưu đãi Mua kèm (SP giá thấp hơn khi mua cùng ${addonNames.join(', ')})`
          : '',
    });
  }

  return map;
}

function loadSavedSelectedKeys(): Set<string> | null {
  try {
    const raw = sessionStorage.getItem(SELECTED_KEY);
    if (!raw) return null;
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? new Set(arr) : null;
  } catch {
    return null;
  }
}

function persistSelectedKeys(keys: Set<string>): void {
  try {
    sessionStorage.setItem(SELECTED_KEY, JSON.stringify(Array.from(keys)));
  } catch {}
}

function cleanCartStr(s?: string): string {
  return (s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/[^a-z0-9]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

@Injectable({ providedIn: 'root' })
export class CartService {
  private api = inject(ApiService);

  // ── Auth ────────────────────────────────────────────────
  private _currentUser = signal<XanhLaUser | null>(this._loadUser());
  readonly currentUser = this._currentUser.asReadonly();

  private _authModalOpen = signal(false);
  readonly authModalOpen = this._authModalOpen.asReadonly();

  private _authTab = signal<AuthTab>('login');
  readonly authTab = this._authTab.asReadonly();

  private _authPrefill = signal<AuthModalPrefill | null>(null);
  readonly authPrefill = this._authPrefill.asReadonly();

  // ── Cart state ──────────────────────────────────────────
  private _items = signal<XanhLaCartItem[]>([]);
  readonly items = this._items.asReadonly();

  // ── Cart item selection (tick chọn sản phẩm để thanh toán) ──
  private _selectedKeys = signal<Set<string>>(new Set());
  readonly selectedKeys = this._selectedKeys.asReadonly();

  // ── Recently Viewed Products (MongoDB per user / sessionStorage cho khách chưa đăng nhập) ──
  private _viewedProducts = signal<ViewedProductItem[]>([]);
  readonly viewedProducts = this._viewedProducts.asReadonly();

  // ── Direct Buy Now Session & Modal (Hoàn toàn tách biệt khỏi Giỏ hàng) ──────
  private _buyNowModalOpen = signal(false);
  readonly buyNowModalOpen = this._buyNowModalOpen.asReadonly();

  private _buyNowProduct = signal<XanhLaProduct | null>(null);
  readonly buyNowProduct = this._buyNowProduct.asReadonly();

  private _buyNowQuantity = signal(1);
  readonly buyNowQuantity = this._buyNowQuantity.asReadonly();

  private _buyNowOption = signal<string>('');
  readonly buyNowOption = this._buyNowOption.asReadonly();

  private _buyNowSession = signal<XanhLaCartItem[] | null>(this._loadBuyNowSession());
  readonly buyNowSession = this._buyNowSession.asReadonly();

  readonly buyNowItem = computed<XanhLaCartItem | null>(() => this._buyNowSession()?.[0] ?? null);

  openBuyNowModal(product: XanhLaProduct, initialQty = 1, option?: string): void {
    const maxStock = resolveProductMaxStock(product);
    if (maxStock === 0) return;
    const clampedQty = maxStock !== null ? Math.min(maxStock, Math.max(1, initialQty)) : Math.max(1, initialQty);
    this._buyNowProduct.set(product);
    this._buyNowQuantity.set(clampedQty);
    const defaultOpt = option || (product.options?.[0]?.values?.[0] ?? '');
    this._buyNowOption.set(defaultOpt);
    this._buyNowModalOpen.set(true);

    // Đối chiếu lại tồn kho thực tế từ API để tránh sản phẩm hết hàng (như Flash Sale chưa đồng bộ) đi tiếp vào Checkout
    const cleanSlug = String(product.slug || '').replace(/^\/product-page\//, '').replace(/^\//, '');
    if (cleanSlug) {
      this.api.get<{ success: boolean; data: any }>(`/products/${encodeURIComponent(cleanSlug)}`).subscribe({
        next: (res) => {
          const live = res?.data;
          if (!live) return;
          const current = this._buyNowProduct();
          if (!current || (current.slug !== product.slug && current.id !== product.id)) return;
          const liveStock = live.isActive === false || live.comboStatus === 'paused' || live.comboStatus === 'hidden'
            ? 0
            : (live.isCombo && typeof live.availableStock === 'number'
                ? Math.max(0, Math.floor(live.availableStock))
                : (typeof live.stock === 'number' ? Math.max(0, Math.floor(live.stock)) : current.stock));
          const updated: XanhLaProduct = {
            ...current,
            stock: liveStock,
            availableStock: typeof live.availableStock === 'number' ? Math.max(0, Math.floor(live.availableStock)) : current.availableStock,
            comboStatus: live.comboStatus ?? current.comboStatus,
            isCombo: live.isCombo ?? current.isCombo,
          };
          this._buyNowProduct.set(updated);
          const refreshedMax = resolveProductMaxStock(updated);
          if (refreshedMax !== null && refreshedMax > 0 && this._buyNowQuantity() > refreshedMax) {
            this._buyNowQuantity.set(refreshedMax);
          }
        },
        error: () => {},
      });
    }
  }

  closeBuyNowModal(): void {
    this._buyNowModalOpen.set(false);
  }

  setBuyNowQuantity(qty: number): void {
    const maxStock = resolveProductMaxStock(this._buyNowProduct());
    const parsed = Math.max(1, Math.floor(qty) || 1);
    const clamped = maxStock !== null && maxStock > 0 ? Math.min(maxStock, parsed) : parsed;
    this._buyNowQuantity.set(clamped);
  }

  setBuyNowOption(opt: string): void {
    this._buyNowOption.set(opt);
  }

  startDirectBuyNow(product: XanhLaProduct, quantity: number, selectedOption?: string): void {
    const maxStock = resolveProductMaxStock(product);
    if (maxStock === 0) return;
    const cleanOption = resolveProductOption(product, selectedOption);
    const combo = isComboProduct(product);
    const safeQty = maxStock !== null ? Math.min(maxStock, Math.max(1, Math.floor(quantity) || 1)) : Math.max(1, Math.floor(quantity) || 1);
    const item: XanhLaCartItem = {
      product,
      quantity: safeQty,
      selectedOption: cleanOption,
      itemType: combo ? 'combo' : 'regular',
      isCombo: combo,
      originalPriceNumber: product.originalPriceNumber,
    };
    this._saveBuyNowSession([item]);
    this.closeBuyNowModal();
  }

  startDirectBundleBuyNow(
    mainProduct: XanhLaProduct,
    mainQuantity: number,
    mainOption: string | undefined,
    addOns: {
      product: XanhLaProduct;
      discountType: 'percent' | 'fixed';
      discountValue: number;
      quantity?: number;
    }[]
  ): void {
    const mainMax = resolveProductMaxStock(mainProduct);
    if (mainMax === 0) return;
    const rawQty = Math.max(1, Math.round(mainQuantity || 1));
    const safeMainQty = mainMax !== null ? Math.min(mainMax, rawQty) : rawQty;
    const mainId = mainProduct.id || mainProduct.slug;
    const cleanMainOption = resolveProductOption(mainProduct, mainOption);

    const items: XanhLaCartItem[] = [
      {
        product: mainProduct,
        quantity: safeMainQty,
        selectedOption: cleanMainOption,
        itemType: 'regular',
      }
    ];

    for (const ao of addOns) {
      if (!ao || !ao.product || ao.product.isCombo) continue;
      if (resolveProductMaxStock(ao.product) === 0) continue;
      const aoMax = resolveProductMaxStock(ao.product);
      const rawAoQty = Math.max(1, Math.round(ao.quantity ?? safeMainQty));
      const aoQty = aoMax !== null ? Math.min(aoMax, rawAoQty) : rawAoQty;
      items.push({
        product: ao.product,
        quantity: aoQty,
        selectedOption: '',
        itemType: 'addon',
        linkedMainProductId: mainId,
        linkedMainProductSlug: mainProduct.slug,
        linkedMainProductName: mainProduct.name,
        addonDiscountType: ao.discountType,
        addonDiscountValue: ao.discountValue,
      });
    }

    this._saveBuyNowSession(items);
    this.closeBuyNowModal();
  }

  clearBuyNowSession(): void {
    this._saveBuyNowSession(null);
  }

  updateBuyNowItemQuantity(item: XanhLaCartItem, quantity: number): void {
    const targetKey = getCartItemKey(item);
    const current = this._buyNowSession();
    if (!current || current.length === 0) return;
    const existing = current.find((i) => getCartItemKey(i) === targetKey);
    const maxStock = resolveProductMaxStock(existing?.product ?? item.product);
    const requested = Math.max(1, Math.min(99, Math.floor(quantity) || 1));
    if (maxStock === 0 && existing && requested > existing.quantity) return;
    const upperBound = maxStock !== null && maxStock > 0 ? maxStock : 99;
    const safeQty = Math.max(1, Math.min(upperBound, requested));
    const updated = current.map((i) =>
      getCartItemKey(i) === targetKey ? { ...i, quantity: safeQty } : i
    );
    this._saveBuyNowSession(updated);
  }

  private _saveBuyNowSession(items: XanhLaCartItem[] | null): void {
    this._buyNowSession.set(items);
    try {
      if (items && items.length > 0) {
        sessionStorage.setItem('xanhla_buy_now_session', JSON.stringify(items));
      } else {
        sessionStorage.removeItem('xanhla_buy_now_session');
        sessionStorage.removeItem('xanhla_buy_now');
      }
    } catch {}
  }

  private _loadBuyNowSession(): XanhLaCartItem[] | null {
    try {
      const raw = sessionStorage.getItem('xanhla_buy_now_session');
      if (raw) return JSON.parse(raw);
      const legacyRaw = sessionStorage.getItem('xanhla_buy_now');
      if (legacyRaw) {
        const it = JSON.parse(legacyRaw);
        return it ? [it] : null;
      }
      return null;
    } catch {
      return null;
    }
  }

  private _sanitizeAndMergeItems(items: XanhLaCartItem[]): XanhLaCartItem[] {
    const merged: XanhLaCartItem[] = [];
    for (const item of items) {
      const hasOptions = Array.isArray(item.product?.options) && item.product.options.length > 0;
      const opt = hasOptions ? (item.selectedOption?.trim() || undefined) : undefined;
      const itName = cleanCartStr(item.product.name);
      const itSlug = cleanCartStr((item.product.slug || '').replace(/^\/product-page\//, '').replace(/^\//, ''));
      const itId = cleanCartStr(item.product.id || (item.product as any)._id);

      const existing = merged.find((m) => {
        if (m.itemType !== item.itemType) return false;
        if (hasOptions && (m.selectedOption ?? '') !== (opt ?? '')) return false;
        if ((m.linkedMainProductId ?? '') !== (item.linkedMainProductId ?? '')) return false;

        const mSlug = cleanCartStr((m.product.slug || '').replace(/^\/product-page\//, '').replace(/^\//, ''));
        const mId = cleanCartStr(m.product.id || (m.product as any)._id);
        const mName = cleanCartStr(m.product.name);

        return (
          (mSlug && itSlug && mSlug === itSlug) ||
          (mId && itId && mId === itId) ||
          (mName && itName && mName === itName)
        );
      });
      if (existing) {
        existing.quantity += item.quantity;
      } else {
        merged.push({ ...item, selectedOption: opt });
      }
    }
    return merged;
  }

  constructor() {
    const user = this._currentUser();
    const ident = user ? (user.phone || user.email || user._id || 'guest') : 'guest';
    const loaded = this._loadCartForUser(ident, user?.email);
    const sanitized = this._sanitizeAndMergeItems(loaded);
    this._items.set(sanitized);
    if (sanitized.length !== loaded.length) {
      this._saveCartForCurrentUser(sanitized);
    }

    const saved = loadSavedSelectedKeys();
    const allItemKeys = new Set(sanitized.map(i => getCartItemKey(i)));
    if (saved && saved.size > 0) {
      const validKeys = new Set([...saved].filter(k => allItemKeys.has(k)));
      this._selectedKeys.set(validKeys.size > 0 ? validKeys : allItemKeys);
    } else {
      this._selectedKeys.set(allItemKeys);
    }

    if (user) {
      this.loadUserData();
      this.loadViewedProducts();
    } else {
      this._viewedProducts.set(this._loadGuestViewedProducts());
    }
  }

  readonly isSelected = (slug: string, selectedOption?: string): boolean => {
    return this._selectedKeys().has(cartItemKey(slug, selectedOption));
  };

  readonly isSelectedItem = (item: XanhLaCartItem): boolean => {
    return this._selectedKeys().has(getCartItemKey(item));
  };

  toggleItem(slug: string, selectedOption?: string): void {
    const key = cartItemKey(slug, selectedOption);
    this._selectedKeys.update(set => {
      const next = new Set(set);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      persistSelectedKeys(next);
      return next;
    });
  }

  toggleCartItem(item: XanhLaCartItem): void {
    const key = getCartItemKey(item);
    this._selectedKeys.update(set => {
      const next = new Set(set);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      persistSelectedKeys(next);
      return next;
    });
  }

  selectAll(): void {
    const all = new Set(this._items().map(i => getCartItemKey(i)));
    this._selectedKeys.set(all);
    persistSelectedKeys(all);
  }

  unselectAll(): void {
    const empty = new Set<string>();
    this._selectedKeys.set(empty);
    persistSelectedKeys(empty);
  }

  toggleAll(): void {
    if (this.isAllSelected()) {
      this.unselectAll();
    } else {
      this.selectAll();
    }
  }

  selectOnly(slug: string, selectedOption?: string): void {
    const cleanSlug = cleanCartStr((slug || '').replace(/^\/product-page\//, '').replace(/^\//, ''));
    const currentItems = this._items();
    let found = currentItems.find(i => {
      const itSlug = cleanCartStr((i.product.slug || '').replace(/^\/product-page\//, '').replace(/^\//, ''));
      if (itSlug !== cleanSlug) return false;
      if (selectedOption && i.selectedOption) {
        return cleanCartStr(i.selectedOption) === cleanCartStr(selectedOption);
      }
      return true;
    });

    if (!found) {
      found = currentItems.find(i => {
        const itName = cleanCartStr(i.product.name);
        return itName.includes(cleanSlug) || cleanSlug.includes(itName);
      });
    }

    const key = found ? getCartItemKey(found) : cartItemKey(slug, selectedOption);
    const next = new Set<string>([key]);
    this._selectedKeys.set(next);
    persistSelectedKeys(next);
  }

  selectOnlyKeys(keys: string[] | Set<string>): void {
    const next = new Set<string>(keys);
    this._selectedKeys.set(next);
    persistSelectedKeys(next);
  }

  selectOnlyRecipeItems(ingredients: { name: string; product?: any }[]): Set<string> {
    const matchingKeys = new Set<string>();
    const cartItems = this._items();

    for (const it of cartItems) {
      const itSlug = cleanCartStr((it.product.slug || '').replace(/^\/product-page\//, '').replace(/^\//, ''));
      const itId = cleanCartStr(it.product.id || (it.product as any)._id);
      const itName = cleanCartStr(it.product.name);

      let isRecipeItem = false;
      for (const ing of ingredients) {
        const ingName = cleanCartStr(ing.name);
        const prod = ing.product;
        const prodSlug = prod?.slug
          ? cleanCartStr((prod.slug || '').replace(/^\/product-page\//, '').replace(/^\//, ''))
          : '';
        const prodId = prod?._id || prod?.id ? cleanCartStr(String(prod._id || prod.id)) : '';
        const prodName = prod?.name ? cleanCartStr(prod.name) : '';

        if (
          (prodSlug && itSlug && (itSlug === prodSlug || itSlug.includes(prodSlug) || prodSlug.includes(itSlug))) ||
          (prodId && itId && itId === prodId) ||
          (prodName && itName && (itName.includes(prodName) || prodName.includes(itName))) ||
          (ingName && itName && (itName.includes(ingName) || ingName.includes(itName)))
        ) {
          isRecipeItem = true;
          break;
        }
      }

      if (isRecipeItem) {
        matchingKeys.add(getCartItemKey(it));
      }
    }

    this._selectedKeys.set(matchingKeys);
    persistSelectedKeys(matchingKeys);
    return matchingKeys;
  }

  selectOnlyMatchingProducts(productSlugsOrIds: string[]): void {
    const targetSet = new Set(productSlugsOrIds.map(s => cleanCartStr(s)));
    const matchingKeys = new Set<string>();
    for (const it of this._items()) {
      const slug = cleanCartStr((it.product.slug || '').replace(/^\/product-page\//, '').replace(/^\//, ''));
      const id = cleanCartStr(it.product.id || (it.product as any)._id);
      const name = cleanCartStr(it.product.name);
      if (targetSet.has(slug) || targetSet.has(id) || targetSet.has(name)) {
        matchingKeys.add(getCartItemKey(it));
      }
    }
    this._selectedKeys.set(matchingKeys);
    persistSelectedKeys(matchingKeys);
  }

  removeSelectedItems(): void {
    const set = this._selectedKeys();
    this._items.update(current => {
      const updated = current.filter(i => !set.has(getCartItemKey(i)));
      this._saveCartForCurrentUser(updated);
      return updated;
    });
    this._selectedKeys.set(new Set());
    persistSelectedKeys(new Set());
  }

  readonly isAllSelected = computed(() => {
    const items = this._items();
    if (items.length === 0) return false;
    const set = this._selectedKeys();
    return items.every(i => set.has(getCartItemKey(i)));
  });

  readonly allSelected = this.isAllSelected;

  readonly selectedItems = computed<XanhLaCartItem[]>(() => {
    const set = this._selectedKeys();
    return this._items().filter(i => set.has(getCartItemKey(i)));
  });

  // ── Selected items count ────────────────────────────────
  readonly selectedCount = computed(() => {
    const set = this._selectedKeys();
    return this._items()
      .filter(i => set.has(getCartItemKey(i)))
      .reduce((sum, i) => sum + i.quantity, 0);
  });

  // ── Pricing Maps ────────────────────────────────────────

  readonly allPricingMap = computed<Map<string, EvaluatedCartItemPricing>>(() => {
    return evaluateItemsPricingMap(this._items());
  });

  readonly selectedPricingMap = computed<Map<string, EvaluatedCartItemPricing>>(() => {
    const set = this._selectedKeys();
    const selItems = this._items().filter(i => set.has(getCartItemKey(i)));
    return evaluateItemsPricingMap(selItems);
  });

  getPricingForItem(item: XanhLaCartItem): EvaluatedCartItemPricing | undefined {
    return this.allPricingMap().get(getCartItemKey(item));
  }

  getSelectedPricingForItem(item: XanhLaCartItem): EvaluatedCartItemPricing | undefined {
    return this.selectedPricingMap().get(getCartItemKey(item));
  }

  getItemPricing(item: XanhLaCartItem, scope: 'all' | 'selected' | 'buynow' = 'all'): EvaluatedCartItemPricing {
    const key = getCartItemKey(item);
    const map = scope === 'buynow'
      ? this.buyNowPricingMap()
      : (scope === 'selected' ? this.selectedPricingMap() : this.allPricingMap());
    const found = map.get(key);
    if (found) return found;

    const basePrice = unitPriceOf(item.product);
    const lineTotal = basePrice * (item.quantity || 1);
    return {
      key,
      itemType: item.itemType || 'regular',
      originalUnitPrice: basePrice,
      effectiveUnitPrice: basePrice,
      lineOriginalTotal: lineTotal,
      linePayableTotal: lineTotal,
      lineSaving: 0,
      comboSaving: 0,
      addonSaving: 0,
      discountedByAddon: false,
      discountedQty: 0,
      isAddonActive: false,
      missingMainWarning: '',
      promoBadge: '',
      relationLabel: '',
    };
  }

  readonly count = computed(() =>
    this._items().reduce((sum, i) => sum + i.quantity, 0)
  );
  readonly itemCount = this.count;

  // ── Unified Pricing Totals (DRY: tính toán 1 lần duy nhất cho toàn bộ nhóm) ──
  readonly allTotals = computed(() => aggregatePricingTotals(this.allPricingMap()));
  readonly selectedTotals = computed(() => aggregatePricingTotals(this.selectedPricingMap()));
  readonly buyNowPricingMap = computed<Map<string, EvaluatedCartItemPricing>>(() => {
    const s = this._buyNowSession();
    return s && s.length > 0 ? evaluateItemsPricingMap(s) : new Map();
  });
  readonly buyNowTotals = computed(() => aggregatePricingTotals(this.buyNowPricingMap()));

  readonly originalTotal = computed(() => this.selectedTotals().originalSubtotal);
  readonly selectedOriginalSubtotal = this.originalTotal;

  readonly total = computed(() => this.selectedTotals().subtotal);
  readonly selectedSubtotal = this.total;

  readonly comboDiscountTotal = computed(() => this.selectedTotals().comboDiscount);
  readonly selectedComboDiscount = this.comboDiscountTotal;

  readonly addOnDiscountTotal = computed(() => this.selectedTotals().addonDiscount);
  readonly selectedAddonDiscount = this.addOnDiscountTotal;

  readonly cartTotalSavings = computed(() => this.selectedTotals().totalSavings);
  readonly allItemsTotal = computed(() => this.allTotals().subtotal);

  // Buy Now getters
  readonly buyNowOriginalSubtotal = computed(() => this.buyNowTotals().originalSubtotal);
  readonly buyNowSubtotal = computed(() => this.buyNowTotals().subtotal);
  readonly buyNowComboDiscount = computed(() => this.buyNowTotals().comboDiscount);
  readonly buyNowAddonDiscount = computed(() => this.buyNowTotals().addonDiscount);

  // ── Drawer ──────────────────────────────────────────────
  private _cartDrawerOpen = signal(false);
  readonly cartDrawerOpen = this._cartDrawerOpen.asReadonly();

  // ── Cart methods ────────────────────────────────────────

  animateFlyToCart(source?: Event | HTMLElement, imageUrl?: string): void {
    animateFlyToCart(source, imageUrl);
  }

  addItem(
    product: XanhLaProduct,
    quantity = 1,
    selectedOption?: string,
    opts?: { openDrawer?: boolean; event?: Event | HTMLElement; setExactQuantity?: boolean }
  ): void {
    const maxStock = resolveProductMaxStock(product);
    if (maxStock === 0) return;

    if (opts?.event) {
      animateFlyToCart(opts.event, product.image);
    }
    const cleanOption = resolveProductOption(product, selectedOption);
    const hasOptions = cleanOption !== undefined;
    const combo = isComboProduct(product);
    const itemType: 'regular' | 'combo' = combo ? 'combo' : 'regular';
    const key = cartItemKey(product.slug, cleanOption, itemType);

    const prodName = cleanCartStr(product.name);
    const prodSlug = cleanCartStr((product.slug || '').replace(/^\/product-page\//, '').replace(/^\//, ''));
    const prodId = cleanCartStr(product.id || (product as any)._id);

    let matchedItemKey = key;

    this._items.update((current) => {
      const idx = current.findIndex((i) => {
        if (i.itemType === 'addon') return false;
        if (hasOptions && (i.selectedOption ?? '') !== (cleanOption ?? '')) return false;

        const itSlug = cleanCartStr((i.product.slug || '').replace(/^\/product-page\//, '').replace(/^\//, ''));
        const itId = cleanCartStr(i.product.id || (i.product as any)._id);
        const itName = cleanCartStr(i.product.name);

        return (
          (itSlug && prodSlug && itSlug === prodSlug) ||
          (itId && prodId && itId === prodId) ||
          (itName && prodName && (itName === prodName || itName.includes(prodName) || prodName.includes(itName)))
        );
      });

      if (idx >= 0) {
        matchedItemKey = getCartItemKey(current[idx]);
        const updated = current.map((i, index) => {
          if (index !== idx) return i;
          const baseProduct = product.priceNumber && product.priceNumber < (i.product.priceNumber || 0) ? product : i.product;
          const syncedProduct: XanhLaProduct = {
            ...baseProduct,
            stock: product.stock ?? baseProduct.stock,
            availableStock: product.availableStock ?? baseProduct.availableStock,
            comboStatus: product.comboStatus ?? baseProduct.comboStatus,
            isCombo: combo || baseProduct.isCombo,
          };
          const rawNext = opts?.setExactQuantity ? Math.max(1, quantity) : (i.quantity + quantity);
          const cappedNext = maxStock !== null ? Math.min(maxStock, rawNext) : rawNext;
          return {
            ...i,
            product: syncedProduct,
            itemType,
            isCombo: combo,
            quantity: Math.max(1, cappedNext),
            selectedOption: hasOptions ? (i.selectedOption || cleanOption) : undefined,
          };
        });
        this._saveCartForCurrentUser(updated);
        return updated;
      } else {
        const cappedInitial = maxStock !== null ? Math.min(maxStock, Math.max(1, quantity)) : Math.max(1, quantity);
        const updated = [...current, { product, quantity: cappedInitial, selectedOption: cleanOption, itemType, isCombo: combo }];
        this._saveCartForCurrentUser(updated);
        return updated;
      }
    });

    // Tự động tick chọn sản phẩm vừa thêm (và tick luôn dòng sản phẩm đã tồn tại được gộp số lượng)
    this._selectedKeys.update((set) => {
      const next = new Set(set);
      next.add(key);
      if (matchedItemKey) next.add(matchedItemKey);
      persistSelectedKeys(next);
      return next;
    });

    if (opts?.openDrawer) {
      this._cartDrawerOpen.set(true);
    }
  }

  ensureItemsSelected(namesOrSlugs: string[]): void {
    const targetSet = new Set(namesOrSlugs.map((s) => cleanCartStr(s)));
    this._selectedKeys.update((set) => {
      const next = new Set(set);
      for (const it of this._items()) {
        const slug = cleanCartStr((it.product.slug || '').replace(/^\/product-page\//, '').replace(/^\//, ''));
        const id = cleanCartStr(it.product.id || (it.product as any)._id);
        const name = cleanCartStr(it.product.name);
        if (targetSet.has(slug) || targetSet.has(id) || targetSet.has(name)) {
          next.add(getCartItemKey(it));
        }
      }
      persistSelectedKeys(next);
      return next;
    });
  }

  /**
   * Thêm đồng thời sản phẩm chính + danh sách sản phẩm mua kèm đã chọn
   */
  addMainWithAddOns(
    mainProduct: XanhLaProduct,
    mainQuantity: number,
    mainOption: string | undefined,
    addOns: {
      product: XanhLaProduct;
      discountType: 'percent' | 'fixed';
      discountValue: number;
      quantity?: number;
    }[],
    opts?: { openDrawer?: boolean; selectOnlyBundle?: boolean; setExactQuantity?: boolean }
  ): boolean {
    const safeMainQty = Math.max(1, Math.round(mainQuantity || 1));
    const mainId = mainProduct.id || mainProduct.slug;
    const hasOptions = Array.isArray(mainProduct.options) && mainProduct.options.length > 0;
    const cleanMainOption = hasOptions ? (mainOption?.trim() || undefined) : undefined;
    const mainKey = cartItemKey(mainProduct.slug, cleanMainOption, 'regular');
    const addedKeys: string[] = [mainKey];

    this._items.update((current) => {
      let updated = [...current];
      const mainIdx = updated.findIndex(
        (i) =>
          i.product.slug === mainProduct.slug &&
          (i.selectedOption ?? '') === (cleanMainOption ?? '') &&
          i.itemType !== 'addon'
      );
      if (mainIdx >= 0) {
        updated[mainIdx] = {
          ...updated[mainIdx],
          product: mainProduct,
          itemType: 'regular',
          quantity: opts?.setExactQuantity ? safeMainQty : (updated[mainIdx].quantity + safeMainQty),
          selectedOption: cleanMainOption,
        };
      } else {
        updated.push({
          product: mainProduct,
          quantity: safeMainQty,
          selectedOption: cleanMainOption,
          itemType: 'regular',
        });
      }

      for (const ao of addOns) {
        if (!ao || !ao.product || ao.product.isCombo) continue;
        const aoItem = buildAddonCartItem(ao, mainProduct, safeMainQty);
        const aoKey = getCartItemKey(aoItem);
        addedKeys.push(aoKey);
        const aoIdx = updated.findIndex((i) => getCartItemKey(i) === aoKey);
        if (aoIdx >= 0) {
          updated[aoIdx] = {
            ...updated[aoIdx],
            product: ao.product,
            quantity: opts?.setExactQuantity ? aoItem.quantity : (updated[aoIdx].quantity + aoItem.quantity),
            addonDiscountType: ao.discountType,
            addonDiscountValue: ao.discountValue,
            linkedMainProductId: mainId,
            linkedMainProductSlug: mainProduct.slug,
            linkedMainProductName: mainProduct.name,
          };
        } else {
          updated.push(aoItem);
        }
      }

      this._saveCartForCurrentUser(updated);
      return updated;
    });

    if (opts?.selectOnlyBundle) {
      const next = new Set(addedKeys);
      this._selectedKeys.set(next);
      persistSelectedKeys(next);
    } else {
      this._selectedKeys.update((set) => {
        const next = new Set(set);
        for (const k of addedKeys) next.add(k);
        persistSelectedKeys(next);
        return next;
      });
    }

    if (opts?.openDrawer === true) {
      this._cartDrawerOpen.set(true);
    }
    return true;
  }

  updateQuantity(slug: string, quantity: number): void {
    this._items.update((current) => {
      const updated = quantity <= 0
        ? current.filter((i) => !(i.product.slug === slug && i.itemType !== 'addon'))
        : current.map((i) => (i.product.slug === slug && i.itemType !== 'addon') ? { ...i, quantity } : i);
      this._saveCartForCurrentUser(updated);
      return updated;
    });
    if (quantity <= 0) {
      this._selectedKeys.update(set => {
        const next = new Set([...set].filter(k => !(k.startsWith(slug + '|') && !k.includes('|addon:'))));
        persistSelectedKeys(next);
        return next;
      });
    }
  }

  updateItemQuantity(item: XanhLaCartItem, quantity: number): void {
    const targetKey = getCartItemKey(item);
    this._items.update((current) => {
      const target = current.find((i) => getCartItemKey(i) === targetKey);
      const maxStock = resolveProductMaxStock(target?.product ?? item.product);
      if (quantity > 0 && target && maxStock === 0 && quantity > target.quantity) {
        return current;
      }
      const nextQty = quantity <= 0
        ? quantity
        : (maxStock !== null && maxStock > 0 ? Math.min(maxStock, quantity) : quantity);
      const updated = nextQty <= 0
        ? current.filter((i) => getCartItemKey(i) !== targetKey)
        : current.map((i) => getCartItemKey(i) === targetKey ? { ...i, quantity: nextQty } : i);
      this._saveCartForCurrentUser(updated);
      return updated;
    });
    if (quantity <= 0) {
      this._selectedKeys.update(set => {
        const next = new Set(set);
        next.delete(targetKey);
        persistSelectedKeys(next);
        return next;
      });
    }
  }

  removeItem(slug: string): void {
    this._items.update((current) => {
      const updated = current.filter((i) => !(i.product.slug === slug && i.itemType !== 'addon'));
      this._saveCartForCurrentUser(updated);
      return updated;
    });
    this._selectedKeys.update(set => {
      const next = new Set([...set].filter(k => !(k.startsWith(slug + '|') && !k.includes('|addon:'))));
      persistSelectedKeys(next);
      return next;
    });
  }

  removeCartItem(item: XanhLaCartItem): void {
    const targetKey = getCartItemKey(item);
    this._items.update((current) => {
      const updated = current.filter((i) => getCartItemKey(i) !== targetKey);
      this._saveCartForCurrentUser(updated);
      return updated;
    });
    this._selectedKeys.update(set => {
      const next = new Set(set);
      next.delete(targetKey);
      persistSelectedKeys(next);
      return next;
    });
  }

  /** Xóa toàn bộ giỏ hàng UI + xóa storage của user hiện tại */
  clear(): void {
    const u = this._currentUser();
    this._items.set([]);
    this._selectedKeys.set(new Set());
    persistSelectedKeys(new Set());
    if (u) {
      try { localStorage.removeItem(cartKey(u.phone || u.email || u._id || 'guest')); } catch { /**/ }
    }
  }

  openCartDrawer(): void  { this._cartDrawerOpen.set(true); }
  closeCartDrawer(): void { this._cartDrawerOpen.set(false); }

  // ── Auth methods ────────────────────────────────────────

  /** Token hết hạn / bị từ chối (401): xóa phiên và mở form đăng nhập lại. */
  expireSession(): void {
    if (!this._currentUser()) return;
    this.logout();
    this.openAuthModal('login');
  }

  // ── Phone-First Registration ─────────────────────────────

  requestRegisterOtp(
    name: string,
    phone: string,
    password: string,
    confirmPassword: string,
    onSuccess: (data: { phone: string; expiresInSeconds?: number; demoOtp?: string }) => void,
    onError: (errMsg: string) => void
  ): void {
    this.api.post<{
      success: boolean;
      message: string;
      phone: string;
      expiresInSeconds?: number;
      demoOtp?: string;
    }>('/auth/register/request-otp', {
      name: name.trim(),
      phone: phone.trim(),
      password,
      confirmPassword,
    }).subscribe({
      next: (res) => {
        if (res.success) {
          onSuccess(res);
        } else {
          onError(res.message || 'Gửi mã OTP thất bại.');
        }
      },
      error: (err) => {
        onError(err.error?.message || 'Không thể gửi mã xác minh OTP. Vui lòng thử lại.');
      }
    });
  }

  verifyRegisterOtp(
    phone: string,
    otp: string,
    onSuccess: (user: XanhLaUser) => void,
    onError: (errMsg: string) => void
  ): void {
    this.api.post<{
      success: boolean;
      token: string;
      user: XanhLaUser;
      message: string;
    }>('/auth/register/verify-otp', {
      phone: phone.trim(),
      otp: otp.trim(),
    }).subscribe({
      next: (res) => {
        if (res.success && res.user && res.token) {
          const user: XanhLaUser = res.user;
          this.applyUserSession(user, res.token);
          this._authModalOpen.set(false);
          this._authPrefill.set(null);
          this.loadUserData();
          onSuccess(user);
        } else {
          onError(res.message || 'Xác minh OTP thất bại.');
        }
      },
      error: (err) => {
        onError(err.error?.message || 'Mã OTP không chính xác hoặc đã hết hạn.');
      }
    });
  }

  resendRegisterOtp(
    phone: string,
    onSuccess: (data: { phone: string; demoOtp?: string }) => void,
    onError: (errMsg: string) => void
  ): void {
    this.api.post<{
      success: boolean;
      message: string;
      phone: string;
      demoOtp?: string;
    }>('/auth/register/resend-otp', {
      phone: phone.trim(),
    }).subscribe({
      next: (res) => {
        if (res.success) {
          onSuccess(res);
        } else {
          onError(res.message || 'Gửi lại mã OTP thất bại.');
        }
      },
      error: (err) => {
        onError(err.error?.message || 'Không thể gửi lại mã OTP.');
      }
    });
  }

  // ── Phone-First Login ─────────────────────────────────────

  // ── Forgot Password (BR-ACC-10) ──────────────────────────────────────────

  requestForgotPasswordOtp(
    phone: string,
    onSuccess: (data: { phone: string; expiresInSeconds?: number; demoOtp?: string }) => void,
    onError: (errMsg: string) => void
  ): void {
    this.api.post<{
      success: boolean;
      message: string;
      phone: string;
      expiresInSeconds?: number;
      demoOtp?: string;
    }>('/auth/forgot-password/request-otp', {
      phone: phone.trim(),
    }).subscribe({
      next: (res) => {
        if (res.success) {
          onSuccess(res);
        } else {
          onError(res.message || 'Yêu cầu đặt lại mật khẩu thất bại.');
        }
      },
      error: (err) => {
        onError(err.error?.message || 'Không thể gửi mã xác minh OTP. Vui lòng kiểm tra lại số điện thoại.');
      }
    });
  }

  verifyForgotPasswordOtp(
    phone: string,
    otp: string,
    onSuccess: (data: { resetToken: string; phone: string; message: string }) => void,
    onError: (errMsg: string) => void
  ): void {
    this.api.post<{
      success: boolean;
      resetToken: string;
      phone: string;
      message: string;
    }>('/auth/forgot-password/verify-otp', {
      phone: phone.trim(),
      otp: otp.trim(),
    }).subscribe({
      next: (res) => {
        if (res.success && res.resetToken) {
          onSuccess(res);
        } else {
          onError(res.message || 'Mã xác minh OTP không hợp lệ.');
        }
      },
      error: (err) => {
        onError(err.error?.message || 'Mã OTP không chính xác hoặc đã hết hạn.');
      }
    });
  }

  resendForgotPasswordOtp(
    phone: string,
    onSuccess: (data: { phone: string; demoOtp?: string }) => void,
    onError: (errMsg: string) => void
  ): void {
    this.api.post<{
      success: boolean;
      message: string;
      phone: string;
      demoOtp?: string;
    }>('/auth/forgot-password/resend-otp', {
      phone: phone.trim(),
    }).subscribe({
      next: (res) => {
        if (res.success) {
          onSuccess(res);
        } else {
          onError(res.message || 'Gửi lại mã OTP thất bại.');
        }
      },
      error: (err) => {
        onError(err.error?.message || 'Không thể gửi lại mã OTP.');
      }
    });
  }

  resetPasswordWithToken(
    phone: string,
    resetToken: string,
    password: string,
    confirmPassword: string,
    onSuccess: (msg: string) => void,
    onError: (errMsg: string) => void
  ): void {
    this.api.post<{
      success: boolean;
      message: string;
    }>('/auth/forgot-password/reset', {
      phone: phone.trim(),
      resetToken: resetToken.trim(),
      password,
      confirmPassword,
    }).subscribe({
      next: (res) => {
        if (res.success) {
          onSuccess(res.message || 'Đặt lại mật khẩu thành công!');
        } else {
          onError(res.message || 'Đặt lại mật khẩu không thành công.');
        }
      },
      error: (err) => {
        onError(err.error?.message || 'Không thể đặt lại mật khẩu. Vui lòng thử lại.');
      }
    });
  }



  login(
    identifier: string,
    password: string,
    onSuccess?: (user: XanhLaUser) => void,
    onError?: (errMsg: string) => void
  ): void {
    this.api.post<{
      success: boolean;
      token: string;
      user: XanhLaUser;
      message?: string;
    }>('/auth/login', {
      identifier: identifier.trim(),
      password,
    }).subscribe({
      next: (res) => {
        if (res.success && res.user && res.token) {
          const user: XanhLaUser = res.user;
          this.applyUserSession(user, res.token);
          this._authModalOpen.set(false);
          this.loadUserData();
          onSuccess?.(user);
        } else {
          const msg = res.message || 'Đăng nhập thất bại.';
          onError ? onError(msg) : alert(msg);
        }
      },
      error: (err) => {
        const errorMsg = err.error?.message || 'Đăng nhập thất bại. Vui lòng thử lại.';
        onError ? onError(errorMsg) : alert(errorMsg);
      }
    });
  }

  // Backward compatibility alias
  loginWithPassword(identifier: string, password: string): void {
    this.login(identifier, password);
  }

  // ── Google Login (Chỉ cho phép tài khoản đã liên kết) ─────

  loginWithGoogle(
    data: { credential?: string; accessToken?: string },
    onSuccess?: () => void,
    onError?: (errMsg: string) => void
  ): void {
    this.api.post<{
      success: boolean;
      token?: string;
      user?: XanhLaUser;
      message?: string;
      code?: string;
    }>('/auth/google', data).subscribe({
      next: (res) => {
        if (res.success && res.user && res.token) {
          const user: XanhLaUser = res.user;
          this.applyUserSession(user, res.token);
          this._authModalOpen.set(false);
          this.loadUserData();
          onSuccess?.();
        } else {
          const msg = res.message || 'Đăng nhập Google thất bại.';
          onError ? onError(msg) : alert(msg);
        }
      },
      error: (err) => {
        const errorMsg = err.error?.message || 'Đăng nhập Google thất bại. Vui lòng thử lại.';
        onError ? onError(errorMsg) : alert(errorMsg);
      }
    });
  }

  // ── Google Account Linking & Unlinking ────────────────────

  linkGoogleAccount(
    tokenData: { credential?: string; accessToken?: string },
    onSuccess: (user: XanhLaUser) => void,
    onError: (errMsg: string) => void
  ): void {
    this.api.post<{
      success: boolean;
      message: string;
      user: XanhLaUser;
    }>('/auth/google/link', tokenData).subscribe({
      next: (res) => {
        if (res.success && res.user) {
          this._currentUser.set(res.user);
          localStorage.setItem(USER_KEY, JSON.stringify(res.user));
          onSuccess(res.user);
        } else {
          onError(res.message || 'Liên kết Google thất bại.');
        }
      },
      error: (err) => {
        onError(err.error?.message || 'Không thể liên kết Google. Vui lòng thử lại.');
      }
    });
  }

  unlinkGoogleAccount(
    password: string,
    onSuccess: (user: XanhLaUser) => void,
    onError: (errMsg: string) => void
  ): void {
    this.api.post<{
      success: boolean;
      message: string;
      user: XanhLaUser;
    }>('/auth/google/unlink', { password }).subscribe({
      next: (res) => {
        if (res.success && res.user) {
          this._currentUser.set(res.user);
          localStorage.setItem(USER_KEY, JSON.stringify(res.user));
          onSuccess(res.user);
        } else {
          onError(res.message || 'Hủy liên kết Google thất bại.');
        }
      },
      error: (err) => {
        onError(err.error?.message || 'Không thể hủy liên kết Google. Vui lòng kiểm tra lại mật khẩu.');
      }
    });
  }

  // ── Change Phone Number ───────────────────────────────────

  requestChangePhoneOtp(
    newPhone: string,
    password: string,
    onSuccess: (data: { newPhone: string; expiresInSeconds?: number; demoOtp?: string }) => void,
    onError: (errMsg: string) => void
  ): void {
    this.api.post<{
      success: boolean;
      message: string;
      newPhone: string;
      expiresInSeconds?: number;
      demoOtp?: string;
    }>('/auth/phone/change/request', {
      newPhone: newPhone.trim(),
      password,
    }).subscribe({
      next: (res) => {
        if (res.success) {
          onSuccess(res);
        } else {
          onError(res.message || 'Yêu cầu đổi số điện thoại thất bại.');
        }
      },
      error: (err) => {
        onError(err.error?.message || 'Không thể gửi mã xác nhận đổi số điện thoại.');
      }
    });
  }

  verifyChangePhoneOtp(
    newPhone: string,
    otp: string,
    onSuccess: (user: XanhLaUser) => void,
    onError: (errMsg: string) => void
  ): void {
    this.api.post<{
      success: boolean;
      message: string;
      user: XanhLaUser;
    }>('/auth/phone/change/verify', {
      newPhone: newPhone.trim(),
      otp: otp.trim(),
    }).subscribe({
      next: (res) => {
        if (res.success && res.user) {
          this._currentUser.set(res.user);
          localStorage.setItem(USER_KEY, JSON.stringify(res.user));
          onSuccess(res.user);
        } else {
          onError(res.message || 'Xác minh đổi số điện thoại thất bại.');
        }
      },
      error: (err) => {
        onError(err.error?.message || 'Mã OTP xác minh không hợp lệ.');
      }
    });
  }

  // Legacy signup alias
  signup(
    name: string,
    email: string,
    password: string,
    onSuccess?: () => void
  ): void {
    this.api.post('/auth/register', {
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password
    }).subscribe({
      next: (res: any) => {
        if (res.success && res.token && (res.user || res.data)) {
          const user: XanhLaUser = res.user || res.data;
          this.applyUserSession(user, res.token);
          this._authModalOpen.set(false);
          this.loadUserData();
          onSuccess?.();
        } else {
          alert('Đăng ký thất bại: ' + (res.message || 'Vui lòng thử lại.'));
        }
      },
      error: (err) => {
        alert(err.error?.message || 'Đăng ký thất bại. Vui lòng thử lại.');
      }
    });
  }

  public loadUserData(): void {
    this.api.get('/account/me').subscribe({
      next: (res: any) => {
        if (res.success && res.data) {
          this._currentUser.set(res.data);
          localStorage.setItem(USER_KEY, JSON.stringify(res.data));
        }
      },
      error: (err) => {
        console.error('Failed to load user data:', err);
      }
    });
  }

  // ── Recently Viewed Products API & Session Management ───

  loadViewedProducts(): void {
    if (!this._currentUser()) {
      this._viewedProducts.set(this._loadGuestViewedProducts());
      return;
    }
    this.api.get<{ success: boolean; data: ViewedProductItem[] }>('/account/viewed-products').subscribe({
      next: (res) => {
        if (res.success && Array.isArray(res.data)) {
          this._viewedProducts.set(res.data);
        }
      },
      error: () => {
        // Không làm ảnh hưởng trải nghiệm nếu lỗi mạng tạm thời
      },
    });
  }

  recordViewedProduct(prod: {
    _id?: string;
    id?: string;
    slug: string;
    name: string;
    image: string;
    price: string;
    priceNumber: number;
    weight?: string;
    unit?: string;
    categoryVi?: string;
    isCombo?: boolean;
  }): void {
    if (!prod || !prod.slug || prod.isCombo) return;

    const pid = String(prod._id || prod.id || prod.slug);
    if (this._currentUser()) {
      this.api
        .post<{ success: boolean; data: ViewedProductItem[] }>('/account/viewed-products', {
          productId: pid,
          slug: prod.slug,
        })
        .subscribe({
          next: (res) => {
            if (res.success && Array.isArray(res.data)) {
              this._viewedProducts.set(res.data);
            }
          },
          error: () => {},
        });
      return;
    }

    // Khách chưa đăng nhập: lưu tạm trong sessionStorage tách biệt hoàn toàn với tài khoản MongoDB
    const nowIso = new Date().toISOString();
    const guestList = this._loadGuestViewedProducts().filter(
      (v) => v.productId !== pid && v.slug !== prod.slug
    );
    const nextList: ViewedProductItem[] = [
      {
        productId: pid,
        slug: prod.slug,
        name: prod.name,
        image: prod.image || '',
        price: prod.price || formatPrice(prod.priceNumber || 0),
        priceNumber: Number(prod.priceNumber) || 0,
        weight: prod.weight || '',
        unit: prod.unit || '',
        categoryVi: prod.categoryVi || '',
        viewedAt: nowIso,
      },
      ...guestList,
    ].slice(0, 20);
    this._saveGuestViewedProducts(nextList);
    this._viewedProducts.set(nextList);
  }

  clearViewedProducts(): void {
    if (this._currentUser()) {
      this.api.delete<{ success: boolean; data: ViewedProductItem[] }>('/account/viewed-products').subscribe({
        next: () => {
          this._viewedProducts.set([]);
        },
        error: () => {},
      });
    } else {
      try { sessionStorage.removeItem(GUEST_VIEWED_KEY); } catch {}
      this._viewedProducts.set([]);
    }
  }

  private applyUserSession(user: XanhLaUser, token: string): void {
    this._currentUser.set(user);
    localStorage.setItem(USER_KEY, JSON.stringify(user));
    localStorage.setItem(TOKEN_KEY, token);

    // Khôi phục giỏ hàng cho user và tự động gộp hàng khách vãng lai đã chọn trước đó
    const ident = user.phone || user.email || user._id || 'guest';
    const userCart = this._loadCartForUser(ident, user.email);
    const guestCart = this._loadCartForUser('guest');

    let merged = [...userCart];
    if (guestCart.length > 0) {
      for (const gItem of guestCart) {
        const idx = merged.findIndex(i => getCartItemKey(i) === getCartItemKey(gItem));
        if (idx >= 0) {
          merged[idx].quantity += gItem.quantity;
        } else {
          merged.push(gItem);
        }
      }
      try { localStorage.removeItem(cartKey('guest')); } catch {}
    }

    this._items.set(merged);
    this._saveCartForCurrentUser(merged);
    const allKeys = new Set(merged.map(i => getCartItemKey(i)));
    this._selectedKeys.set(allKeys);
    persistSelectedKeys(allKeys);

    // Tải lịch sử xem riêng của tài khoản từ MongoDB (không trộn lịch sử khách vãng lai)
    this._viewedProducts.set([]);
    this.loadViewedProducts();
  }

  updateUser(patch: Partial<XanhLaUser>): void {
    const current = this._currentUser();
    if (!current) return;

    const updated = { ...current, ...patch };
    this._currentUser.set(updated);
    localStorage.setItem(USER_KEY, JSON.stringify(updated));

    this.api.put('/account/me', patch).subscribe({
      next: (res: any) => {
        if (res.success && res.data) {
          this._currentUser.set(res.data);
          localStorage.setItem(USER_KEY, JSON.stringify(res.data));
        }
      },
      error: (err) => {
        console.error('Failed to update user profile:', err);
      }
    });
  }

  addAddress(addr: XanhLaAddress): void {
    const current = this._currentUser();
    if (!current) return;
    const addresses = current.addresses ?? [];
    const newList = addr.isDefault
      ? [...addresses.map(a => ({ ...a, isDefault: false })), addr]
      : [...addresses, addr];
    this.updateUser({ addresses: newList });
  }

  updateAddress(addr: XanhLaAddress): void {
    const current = this._currentUser();
    if (!current) return;
    const addresses = current.addresses ?? [];
    const exists = addresses.some(a => a.id === addr.id);
    if (!exists) {
      this.addAddress(addr);
      return;
    }
    const newList = addresses.map(a => {
      if (a.id === addr.id) return addr;
      return addr.isDefault ? { ...a, isDefault: false } : a;
    });
    this.updateUser({ addresses: newList });
  }

  removeAddress(id: string): void {
    const current = this._currentUser();
    if (!current) return;
    this.updateUser({ addresses: (current.addresses ?? []).filter(a => a.id !== id) });
  }

  logout(): void {
    this._currentUser.set(null);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(TOKEN_KEY);
    sessionStorage.removeItem(SELECTED_KEY);
    try { sessionStorage.removeItem(GUEST_VIEWED_KEY); } catch {}
    this._items.set([]);
    this._selectedKeys.set(new Set());
    this._viewedProducts.set([]);
    persistSelectedKeys(new Set());
  }

  openAuthModal(tab: AuthTab = 'login', prefill?: AuthModalPrefill): void {
    this._authPrefill.set(prefill ?? null);
    this._authTab.set(tab);
    this._authModalOpen.set(true);
  }

  closeAuthModal(): void {
    this._authModalOpen.set(false);
    this._authPrefill.set(null);
  }
  setAuthTab(tab: AuthTab): void { this._authTab.set(tab); }

  // ── Private helpers ─────────────────────────────────────

  private _loadGuestViewedProducts(): ViewedProductItem[] {
    try {
      const raw = sessionStorage.getItem(GUEST_VIEWED_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch {
      return [];
    }
  }

  private _saveGuestViewedProducts(items: ViewedProductItem[]): void {
    try {
      sessionStorage.setItem(GUEST_VIEWED_KEY, JSON.stringify(items));
    } catch {}
  }

  private _loadCartForUser(ident: string, fallbackEmail?: string): XanhLaCartItem[] {
    try {
      let raw = localStorage.getItem(cartKey(ident));
      if (!raw && fallbackEmail && fallbackEmail !== ident) {
        raw = localStorage.getItem(cartKey(fallbackEmail));
      }
      return raw ? JSON.parse(raw) : [];
    } catch { return []; }
  }

  private _saveCartForCurrentUser(items: XanhLaCartItem[]): void {
    const u = this._currentUser();
    const ident = u ? (u.phone || u.email || u._id || 'guest') : 'guest';
    try { localStorage.setItem(cartKey(ident), JSON.stringify(items)); } catch { /**/ }
  }

  private _loadUser(): XanhLaUser | null {
    try {
      const raw = localStorage.getItem(USER_KEY);
      const token = localStorage.getItem(TOKEN_KEY);
      if (!raw || !token) {
        localStorage.removeItem(USER_KEY);
        localStorage.removeItem(TOKEN_KEY);
        return null;
      }
      return JSON.parse(raw);
    } catch { return null; }
  }
}
