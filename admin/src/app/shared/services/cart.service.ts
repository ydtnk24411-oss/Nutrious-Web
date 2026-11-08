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

export type AuthTab = 'login' | 'signup';

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

function evaluateItemsPricingMap(items: XanhLaCartItem[]): Map<string, EvaluatedCartItemPricing> {
  const map = new Map<string, EvaluatedCartItemPricing>();
  const regularItems: XanhLaCartItem[] = [];
  const addonItems: XanhLaCartItem[] = [];

  for (const it of items) {
    const key = getCartItemKey(it);
    const basePrice = unitPriceOf(it.product);
    if (it.product.isCombo || it.isCombo || it.itemType === 'combo') {
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

  // ── Cart state ──────────────────────────────────────────
  private _items = signal<XanhLaCartItem[]>([]);
  readonly items = this._items.asReadonly();

  // ── Cart item selection (tick chọn sản phẩm để thanh toán) ──
  private _selectedKeys = signal<Set<string>>(new Set());
  readonly selectedKeys = this._selectedKeys.asReadonly();

  // ── Recently Viewed Products (MongoDB per user / sessionStorage cho khách chưa đăng nhập) ──
  private _viewedProducts = signal<ViewedProductItem[]>([]);
  readonly viewedProducts = this._viewedProducts.asReadonly();

  constructor() {
    const user = this._currentUser();
    if (user) {
      const ident = user.phone || user.email || user._id || 'guest';
      const loaded = this._loadCartForUser(ident, user.email);
      this._items.set(loaded);

      const saved = loadSavedSelectedKeys();
      const allItemKeys = new Set(loaded.map(i => getCartItemKey(i)));
      if (saved && saved.size > 0) {
        const validKeys = new Set([...saved].filter(k => allItemKeys.has(k)));
        this._selectedKeys.set(validKeys.size > 0 ? validKeys : allItemKeys);
      } else {
        this._selectedKeys.set(allItemKeys);
      }

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
      next.has(key) ? next.delete(key) : next.add(key);
      persistSelectedKeys(next);
      return next;
    });
  }

  toggleCartItem(item: XanhLaCartItem): void {
    const key = getCartItemKey(item);
    this._selectedKeys.update(set => {
      const next = new Set(set);
      next.has(key) ? next.delete(key) : next.add(key);
      persistSelectedKeys(next);
      return next;
    });
  }

  toggleAll(): void {
    if (this.allSelected()) {
      const empty = new Set<string>();
      this._selectedKeys.set(empty);
      persistSelectedKeys(empty);
    } else {
      const allKeys = this._items().map(i => getCartItemKey(i));
      const next = new Set(allKeys);
      this._selectedKeys.set(next);
      persistSelectedKeys(next);
    }
  }

  readonly allSelected = computed(() => {
    const items = this._items();
    if (items.length === 0) return false;
    return items.every(i => this._selectedKeys().has(getCartItemKey(i)));
  });

  // Chỉ lấy các sản phẩm ĐƯỢC CHỌN để thanh toán
  readonly selectedItems = computed(() => {
    return this._items().filter(i =>
      this._selectedKeys().has(getCartItemKey(i))
    );
  });

  readonly selectedCount = computed(() =>
    this.selectedItems().length
  );

  /** Bảng tính giá cho các sản phẩm đang được tick chọn thanh toán */
  readonly selectedPricingMap = computed(() =>
    evaluateItemsPricingMap(this.selectedItems())
  );

  /** Bảng tính giá toàn giỏ hàng (dùng cho Cart Drawer và preview) */
  readonly allPricingMap = computed(() =>
    evaluateItemsPricingMap(this._items())
  );

  /** Lấy thông tin giá, loại SP (mua lẻ / combo / mua kèm) và mức giảm cho 1 dòng giỏ hàng */
  getItemPricing(item: XanhLaCartItem, mode: 'selected' | 'all' = 'selected'): EvaluatedCartItemPricing {
    const key = getCartItemKey(item);
    if (mode === 'all') {
      const found = this.allPricingMap().get(key);
      if (found) return found;
    } else if (this._selectedKeys().has(key)) {
      const found = this.selectedPricingMap().get(key);
      if (found) return found;
    }
    const base = unitPriceOf(item.product);
    const isCombo = !!(item.product.isCombo || item.isCombo || item.itemType === 'combo');
    const origUnit = isCombo && item.product.originalPriceNumber && item.product.originalPriceNumber > base
      ? item.product.originalPriceNumber
      : base;
    const comboSav = isCombo ? Math.max(0, (origUnit - base) * item.quantity) : 0;
    const type: 'regular' | 'combo' | 'addon' = isCombo
      ? 'combo'
      : (item.itemType === 'addon' ? 'addon' : 'regular');
    return {
      key,
      itemType: type,
      originalUnitPrice: origUnit,
      effectiveUnitPrice: base,
      lineOriginalTotal: origUnit * item.quantity,
      linePayableTotal: base * item.quantity,
      lineSaving: comboSav,
      comboSaving: comboSav,
      addonSaving: 0,
      discountedByAddon: false,
      discountedQty: 0,
      isAddonActive: false,
      missingMainWarning: type === 'addon' ? 'Tick chọn sản phẩm này cùng sản phẩm chính để tính ưu đãi mua kèm' : '',
      promoBadge: isCombo ? 'Combo tiết kiệm' : (type === 'addon' ? 'Mua kèm' : 'Sản phẩm mua lẻ'),
      relationLabel: item.linkedMainProductName ? `Mua kèm cùng: ${item.linkedMainProductName}` : '',
    };
  }

  /** Tổng giá thực tế phải trả của các sản phẩm được chọn (sau giảm Combo & Mua kèm) */
  readonly selectedSubtotal = computed(() => {
    let sum = 0;
    for (const p of this.selectedPricingMap().values()) {
      sum += p.linePayableTotal;
    }
    return sum;
  });

  /** Tổng giá gốc của các sản phẩm được chọn (trước khi giảm Combo & Mua kèm) */
  readonly selectedOriginalSubtotal = computed(() => {
    let sum = 0;
    for (const p of this.selectedPricingMap().values()) {
      sum += p.lineOriginalTotal;
    }
    return sum;
  });

  /** Tổng tiền tiết kiệm được từ Combo */
  readonly selectedComboDiscount = computed(() => {
    let sum = 0;
    for (const p of this.selectedPricingMap().values()) {
      sum += p.comboSaving;
    }
    return sum;
  });

  /** Tổng tiền tiết kiệm được từ chương trình Mua kèm tiết kiệm hơn */
  readonly selectedAddonDiscount = computed(() => {
    let sum = 0;
    for (const p of this.selectedPricingMap().values()) {
      sum += p.addonSaving;
    }
    return sum;
  });

  /** Khi mua ngay 1 sản phẩm: chỉ chọn duy nhất sản phẩm đó */
  selectOnly(slug: string, selectedOption?: string): void {
    const next = new Set([cartItemKey(slug, selectedOption)]);
    this._selectedKeys.set(next);
    persistSelectedKeys(next);
  }

  /** Xóa chỉ những sản phẩm ĐÃ MUA khỏi giỏ hàng, giữ lại những sản phẩm chưa chọn */
  removeSelectedItems(): void {
    const selected = this._selectedKeys();
    this._items.update((current) => {
      const remaining = current.filter(
        i => !selected.has(getCartItemKey(i))
      );
      this._saveCartForCurrentUser(remaining);
      return remaining;
    });
    // Reset selection về tất cả các món còn lại
    const remainingKeys = this._items().map(i => getCartItemKey(i));
    const next = new Set(remainingKeys);
    this._selectedKeys.set(next);
    persistSelectedKeys(next);
  }

  readonly itemCount = computed(() =>
    this._items().reduce((t, i) => t + i.quantity, 0)
  );

  readonly subtotal = computed(() => {
    let sum = 0;
    for (const p of this.allPricingMap().values()) {
      sum += p.linePayableTotal;
    }
    return sum;
  });

  // ── Drawer ──────────────────────────────────────────────
  private _cartDrawerOpen = signal(false);
  readonly cartDrawerOpen = this._cartDrawerOpen.asReadonly();

  // ── Cart methods ────────────────────────────────────────

  addItem(product: XanhLaProduct, quantity = 1, selectedOption?: string): void {
    if (!this._currentUser()) {
      this.openAuthModal('login');
      return;
    }
    const itemType: 'regular' | 'combo' = product.isCombo ? 'combo' : 'regular';
    const key = cartItemKey(product.slug, selectedOption, itemType);
    this._items.update((current) => {
      const idx = current.findIndex(
        (i) =>
          i.product.slug === product.slug &&
          (i.selectedOption ?? '') === (selectedOption ?? '') &&
          i.itemType !== 'addon'
      );
      const updated = idx >= 0
        ? current.map((i, index) =>
            index === idx ? { ...i, product, itemType, quantity: i.quantity + quantity } : i
          )
        : [...current, { product, quantity, selectedOption, itemType, isCombo: !!product.isCombo }];
      this._saveCartForCurrentUser(updated);
      return updated;
    });
    // Tự động tick chọn sản phẩm vừa thêm
    this._selectedKeys.update(set => {
      const next = new Set(set);
      next.add(key);
      persistSelectedKeys(next);
      return next;
    });
    this._cartDrawerOpen.set(true);
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
    opts?: { openDrawer?: boolean; selectOnlyBundle?: boolean }
  ): boolean {
    if (!this._currentUser()) {
      this.openAuthModal('login');
      return false;
    }
    const safeMainQty = Math.max(1, Math.round(mainQuantity || 1));
    const mainId = mainProduct.id || mainProduct.slug;
    const mainKey = cartItemKey(mainProduct.slug, mainOption, 'regular');
    const addedKeys: string[] = [mainKey];

    this._items.update((current) => {
      let updated = [...current];
      const mainIdx = updated.findIndex(
        (i) =>
          i.product.slug === mainProduct.slug &&
          (i.selectedOption ?? '') === (mainOption ?? '') &&
          i.itemType !== 'addon'
      );
      if (mainIdx >= 0) {
        updated[mainIdx] = {
          ...updated[mainIdx],
          product: mainProduct,
          itemType: 'regular',
          quantity: updated[mainIdx].quantity + safeMainQty,
        };
      } else {
        updated.push({
          product: mainProduct,
          quantity: safeMainQty,
          selectedOption: mainOption,
          itemType: 'regular',
        });
      }

      for (const ao of addOns) {
        if (!ao || !ao.product || ao.product.isCombo) continue;
        const aoQty = Math.max(1, Math.round(ao.quantity ?? safeMainQty));
        const aoKey = cartItemKey(ao.product.slug, '', 'addon', mainId);
        addedKeys.push(aoKey);
        const aoIdx = updated.findIndex((i) => getCartItemKey(i) === aoKey);
        if (aoIdx >= 0) {
          updated[aoIdx] = {
            ...updated[aoIdx],
            product: ao.product,
            quantity: updated[aoIdx].quantity + aoQty,
            addonDiscountType: ao.discountType,
            addonDiscountValue: ao.discountValue,
            linkedMainProductId: mainId,
            linkedMainProductSlug: mainProduct.slug,
            linkedMainProductName: mainProduct.name,
          };
        } else {
          updated.push({
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

    if (opts?.openDrawer !== false) {
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
      const updated = quantity <= 0
        ? current.filter((i) => getCartItemKey(i) !== targetKey)
        : current.map((i) => getCartItemKey(i) === targetKey ? { ...i, quantity } : i);
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

    // Khôi phục giỏ hàng cho user
    const ident = user.phone || user.email || user._id || 'guest';
    const loaded = this._loadCartForUser(ident, user.email);
    this._items.set(loaded);
    const allKeys = new Set(loaded.map(i => getCartItemKey(i)));
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

  openAuthModal(tab: AuthTab = 'login'): void {
    this._authTab.set(tab);
    this._authModalOpen.set(true);
  }

  closeAuthModal(): void { this._authModalOpen.set(false); }
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
    if (!u) return;
    const ident = u.phone || u.email || u._id || 'guest';
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
