import { Component, signal, computed, inject, OnInit, ViewChild, ElementRef, effect } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ShellComponent } from '../../components/shell/shell.component';
import { CartService, formatPrice, calcAddOnUnitDiscount, resolveProductOption } from '../../shared/services/cart.service';
import { ProductApiService, ApiProduct } from '../../shared/services/product-api.service';
import { ReviewService, ReviewEligibility } from '../../shared/services/review.service';
import { XanhLaProduct } from '../../shared/models/xanh-la.models';

export interface AddOnCardView {
  addonId: string;
  addonProd: ApiProduct;
  discountType: 'percent' | 'fixed';
  discountValue: number;
  mainUnitPrice: number;
  addonUnitPrice: number;
  discountTarget: 'addon' | 'main';
  unitSaving: number;
  addonFinalPrice: number;
  mainFinalPrice: number;
  discountLabel: string;
}

function toCartProduct(p: ApiProduct): XanhLaProduct {
  const retailTotal = typeof p.retailTotal === 'number' && p.retailTotal > 0
    ? p.retailTotal
    : p.originalPriceNumber;
  const effStock = typeof p.availableStock === 'number' ? p.availableStock : p.stock;
  return {
    id: p._id, name: p.name, slug: p.slug, price: p.price,
    priceNumber: p.priceNumber, image: p.image,
    category: p.categoryId,
    categoryVi: p.categoryVi || '',
    description: p.description,
    container: p.container, cutType: p.cutType, cutting: p.cutting,
    packSize: p.packSize, packaging: p.packaging, preparation: p.preparation,
    quantity: p.quantity, ripeness: p.ripeness, sizeGroup: p.sizeGroup,
    thickness: p.thickness, type: p.type, weight: p.weight,
    options: p.options,
    stock: effStock,
    isCombo: p.isCombo,
    comboStatus: p.comboStatus,
    originalPriceNumber: retailTotal,
    comboItems: p.comboItems,
    addOnDeals: p.addOnDeals as any,
  };
}

@Component({
  selector: 'app-product-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, ShellComponent, RouterLink],
  templateUrl: './product-detail.component.html',
  styleUrl: './product-detail.component.css',
})
export class ProductDetailComponent implements OnInit {
  protected cart          = inject(CartService);
  private route           = inject(ActivatedRoute);
  private router          = inject(Router);
  private productApi      = inject(ProductApiService);
  private reviewService   = inject(ReviewService);

  protected product       = signal<ApiProduct | null>(null);
  protected loading       = signal(true);
  protected error         = signal('');
  protected quantity      = signal(1);
  protected selectedRipeness = signal('Ready to Eat');
  protected openAccordions   = signal({ info: true, refund: false, shipping: false });

  // Related products (WinMart style)
  protected relatedProducts = signal<ApiProduct[]>([]);
  protected loadingRelated  = signal(false);
  @ViewChild('relatedTrack') private relatedTrack?: ElementRef<HTMLElement>;
  protected canScrollPrev   = signal(false);
  protected canScrollNext   = signal(false);

  // Combo mua kèm tiết kiệm (giữ nguyên độc lập)
  protected combos          = signal<ApiProduct[]>([]);
  protected addedComboId    = signal<string | null>(null);

  // Mua kèm tiết kiệm hơn (chức năng bổ sung độc lập với Combo)
  protected selectedAddOnIds = signal<Set<string>>(new Set());
  protected addOnQuantities  = signal<Record<string, number>>({});
  protected addedBundleNotice = signal(false);

  protected availableAddOnDeals = computed<AddOnCardView[]>(() => {
    const p = this.product();
    if (!p || p.isCombo || !Array.isArray(p.addOnDeals)) return [];
    const mainPrice = Number(p.priceNumber) || 0;
    const views: AddOnCardView[] = [];

    for (const d of p.addOnDeals) {
      if (!d || d.isActive === false || Number(d.discountValue) <= 0) continue;
      const rawAp = d.product;
      if (!rawAp || typeof rawAp !== 'object') continue;
      const ap = rawAp as ApiProduct;
      if (!ap._id || ap._id === p._id || ap.isActive === false || ap.isCombo) continue;
      if (typeof ap.stock === 'number' && ap.stock <= 0) continue;

      const addonPrice = Number(ap.priceNumber) || 0;
      // Quy tắc bắt buộc: Giá bán mua kèm phải THẤP HƠN giá sản phẩm chính
      if (addonPrice <= 0 || mainPrice <= 0 || addonPrice >= mainPrice) {
        continue;
      }
      const discountTarget: 'addon' | 'main' = 'addon';
      const unitSaving = calcAddOnUnitDiscount(addonPrice, d.discountType, d.discountValue);
      if (unitSaving <= 0) continue;

      const discountLabel = d.discountType === 'fixed'
        ? `Giảm ${formatPrice(d.discountValue)}`
        : `Giảm ${d.discountValue}%`;

      views.push({
        addonId: ap._id,
        addonProd: ap,
        discountType: d.discountType,
        discountValue: d.discountValue,
        mainUnitPrice: mainPrice,
        addonUnitPrice: addonPrice,
        discountTarget,
        unitSaving,
        addonFinalPrice: addonPrice - unitSaving,
        mainFinalPrice: mainPrice,
        discountLabel,
      });
    }
    return views;
  });

  protected liveAddOnSummary = computed(() => {
    const p = this.product();
    const cards = this.availableAddOnDeals();
    const selectedSet = this.selectedAddOnIds();
    const qtyMap = this.addOnQuantities();
    const mainQty = Math.max(1, this.quantity());

    const chosen = cards.filter((c) => selectedSet.has(c.addonId));
    const mainPrice = p ? Number(p.priceNumber) || 0 : 0;
    const mainOrigTotal = mainPrice * mainQty;

    if (!p || chosen.length === 0) {
      return {
        selectedCount: 0,
        originalTotal: mainOrigTotal,
        totalSaving: 0,
        finalTotal: mainOrigTotal,
        discountedDescriptions: [] as string[],
      };
    }

    // Áp dụng đúng quy tắc sản phẩm giá thấp hơn nhận giảm giá & không chồng chéo trên cùng 1 đơn vị SP chính
    let unclaimedMainUnits = mainQty;
    let totalSaving = 0;
    let addonsOrigTotal = 0;
    const discountedDescriptions: string[] = [];

    const sorted = [...chosen].sort((a, b) => {
      if (a.discountTarget === 'main' && b.discountTarget === 'main') {
        return b.unitSaving - a.unitSaving;
      }
      return 0;
    });

    for (const c of sorted) {
      const aoQty = Math.max(1, qtyMap[c.addonId] || 1);
      addonsOrigTotal += c.addonUnitPrice * aoQty;

      if (c.discountTarget === 'addon') {
        const pairedQty = Math.min(aoQty, mainQty);
        const saving = c.unitSaving * pairedQty;
        if (saving > 0) {
          totalSaving += saving;
          discountedDescriptions.push(
            `${c.addonProd.name} (x${pairedQty}): -${formatPrice(saving)}`
          );
        }
      } else {
        const pairedQty = Math.min(aoQty, mainQty, unclaimedMainUnits);
        if (pairedQty > 0 && c.unitSaving > 0) {
          unclaimedMainUnits -= pairedQty;
          const saving = c.unitSaving * pairedQty;
          totalSaving += saving;
          discountedDescriptions.push(
            `Ưu đãi khi mua kèm ${c.addonProd.name} (x${pairedQty}): -${formatPrice(saving)}`
          );
        }
      }
    }

    const originalTotal = mainOrigTotal + addonsOrigTotal;
    return {
      selectedCount: chosen.length,
      originalTotal,
      totalSaving,
      finalTotal: Math.max(0, originalTotal - totalSaving),
      discountedDescriptions,
    };
  });

  protected recentViewedExcludingCurrent = computed(() => {
    const cur = this.product();
    return this.cart
      .viewedProducts()
      .filter((v) => !cur || (v.slug !== cur.slug && v.productId !== cur._id))
      .slice(0, 10);
  });

  // Review state
  showReviewForm = signal(false);
  reviewRating = signal(0);
  reviewTitle = signal('');
  reviewContent = signal('');
  reviewImages = signal<string[]>([]);
  previewImageUrl = signal<string | null>(null);
  reviewFilter = signal<'all' | '5' | '4' | '3' | '2' | '1' | 'latest' | 'withImages'>('all');
  submittingReview = signal(false);
  reviewEligibility = signal<ReviewEligibility | null>(null);
  checkingEligibility = signal(false);
  reviewNotice = signal('');
  protected localHelpfulReviews = signal<Set<string>>(new Set());

  constructor() {
    try {
      const stored = localStorage.getItem('xanhla_helpful_reviews');
      if (stored) {
        this.localHelpfulReviews.set(new Set(JSON.parse(stored)));
      }
    } catch {}

    effect(() => {
      const u = this.cart.currentUser();
      const p = this.product();
      if (u && p?._id) {
        this.checkReviewEligibility(p._id);
      } else {
        this.reviewEligibility.set(null);
        this.reviewNotice.set('');
      }
    });
  }

  checkReviewEligibility(productId: string): void {
    if (!this.cart.currentUser() || !productId) {
      this.reviewEligibility.set(null);
      return;
    }
    this.checkingEligibility.set(true);
    this.reviewService.checkEligibility(productId).subscribe({
      next: (res) => {
        this.checkingEligibility.set(false);
        if (res.success) {
          this.reviewEligibility.set(res);
        }
      },
      error: () => {
        this.checkingEligibility.set(false);
      }
    });
  }

  onWriteReviewClick(): void {
    if (!this.cart.currentUser()) {
      this.cart.openAuthModal('login');
      return;
    }

    const elig = this.reviewEligibility();
    if (!elig) {
      const p = this.product();
      if (p?._id) {
        this.checkingEligibility.set(true);
        this.reviewService.checkEligibility(p._id).subscribe({
          next: (res) => {
            this.checkingEligibility.set(false);
            this.reviewEligibility.set(res);
            if (res.canReview) {
              this.showReviewForm.set(!this.showReviewForm());
              this.reviewNotice.set('');
            } else {
              this.reviewNotice.set(res.message);
            }
          },
          error: (err) => {
            this.checkingEligibility.set(false);
            alert(err?.error?.message || 'Không thể kiểm tra điều kiện đánh giá.');
          }
        });
      }
      return;
    }

    if (elig.hasReviewed) {
      this.reviewNotice.set('Bạn đã đánh giá sản phẩm này rồi. Mỗi tài khoản chỉ có thể đánh giá một lần.');
      return;
    }

    if (!elig.hasDeliveredOrder) {
      if (elig.hasPendingOrder) {
        this.reviewNotice.set('Đơn hàng của bạn đang được xử lý hoặc giao hàng. Bạn chỉ có thể đánh giá sau khi đã nhận được hàng thành công.');
      } else {
        this.reviewNotice.set('Bắt buộc phải mua và nhận hàng thành công mới được đánh giá sản phẩm này.');
      }
      return;
    }

    if (elig.canReview) {
      this.showReviewForm.set(!this.showReviewForm());
      this.reviewNotice.set('');
    }
  }

  ngOnInit(): void {
    if (this.route.paramMap) {
      this.route.paramMap.subscribe(params => {
        const slug = params.get('slug') ?? this.route.snapshot?.paramMap?.get('slug') ?? '';
        if (slug) {
          this.loadProduct(slug);
        }
      });
    } else {
      const slug = this.route.snapshot?.paramMap?.get('slug') ?? '';
      if (slug) {
        this.loadProduct(slug);
      }
    }
  }

  private loadProduct(slug: string): void {
    this.loading.set(true);
    this.error.set('');
    this.quantity.set(1);
    this.selectedRipeness.set('Ready to Eat');
    this.selectedAddOnIds.set(new Set());
    this.addOnQuantities.set({});
    this.addedBundleNotice.set(false);
    this.showReviewForm.set(false);
    this.reviewImages.set([]);
    this.previewImageUrl.set(null);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }

    // Thử slug trực tiếp, backend hỗ trợ cả dạng slug thuần và /product-page/xxx
    this.productApi.getBySlug(slug).subscribe({
      next: (res) => {
        this.product.set(res.data);
        this.loading.set(false);
        if (res.data && !res.data.isCombo) {
          this.cart.recordViewedProduct(res.data);
        }
        if (res.data?._id) {
          this.reviewService.load(res.data._id);
        }
        this.loadRelatedProducts(res.data);
      },
      error: () => {
        // Thử thêm prefix nếu slug trực tiếp không tìm thấy
        const prefixed = slug.startsWith('/product-page/') ? slug.replace('/product-page/', '') : slug;
        this.productApi.getBySlug(prefixed).subscribe({
          next: (r) => {
            this.product.set(r.data);
            this.loading.set(false);
            if (r.data && !r.data.isCombo) {
              this.cart.recordViewedProduct(r.data);
            }
            if (r.data?._id) {
              this.reviewService.load(r.data._id);
            }
            this.loadRelatedProducts(r.data);
          },
          error: () => {
            this.error.set('Không tìm thấy sản phẩm.');
            this.loading.set(false);
          },
        });
      },
    });
  }

  private loadRelatedProducts(current: ApiProduct | null | undefined): void {
    this.relatedProducts.set([]);
    this.loadCombos(current);
    if (!current) return;
    this.loadingRelated.set(true);
    const exclude = (list: ApiProduct[]) =>
      (list || []).filter(p => p._id !== current._id).slice(0, 12);

    // Fallback: dùng endpoint danh sách có sẵn, lọc theo cùng danh mục
    const loadByCategory = () => {
      const cat = current.categoryId || current.category || '';
      if (!cat) {
        this.loadingRelated.set(false);
        return;
      }
      this.productApi.getAll({ categoryId: String(cat), limit: 13 }).subscribe({
        next: (res) => {
          this.loadingRelated.set(false);
          this.relatedProducts.set(exclude(res.data));
          this.refreshScrollState();
        },
        error: () => this.loadingRelated.set(false),
      });
    };

    this.productApi.getRelated(current.slug || current._id, 12).subscribe({
      next: (res) => {
        const list = exclude(res.data);
        if (list.length) {
          this.loadingRelated.set(false);
          this.relatedProducts.set(list);
          this.refreshScrollState();
        } else {
          loadByCategory();
        }
      },
      error: () => loadByCategory(),
    });
  }

  // ── Sản phẩm liên quan: cuộn ngang 1 hàng ─────────────────────
  scrollRelated(direction: 1 | -1): void {
    const el = this.relatedTrack?.nativeElement;
    if (!el) return;
    el.scrollBy({ left: direction * Math.max(240, el.clientWidth * 0.8), behavior: 'smooth' });
  }

  onRelatedScroll(): void {
    const el = this.relatedTrack?.nativeElement;
    if (!el) return;
    this.canScrollPrev.set(el.scrollLeft > 4);
    this.canScrollNext.set(el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }

  private refreshScrollState(): void {
    // Chờ Angular render xong danh sách rồi mới đo kích thước
    setTimeout(() => this.onRelatedScroll(), 0);
  }

  // ── Combo mua kèm tiết kiệm ───────────────────────────────────
  private loadCombos(current: ApiProduct | null | undefined): void {
    this.combos.set([]);
    this.addedComboId.set(null);
    if (!current) return;
    this.productApi.getCombos(current.slug || current._id, 3).subscribe({
      next: (res) => this.combos.set(res.data || []),
      error: () => this.combos.set([]),
    });
  }

  comboRetail(combo: ApiProduct): number {
    if (typeof combo.retailTotal === 'number' && combo.retailTotal > 0) {
      return combo.retailTotal;
    }
    if (typeof combo.originalPriceNumber === 'number' && combo.originalPriceNumber > 0) {
      return combo.originalPriceNumber;
    }
    if (Array.isArray(combo.comboItems) && combo.comboItems.length > 0) {
      return combo.comboItems.reduce((sum, it) => {
        const unitPrice = Number(it?.product?.priceNumber) || 0;
        const qty = Math.max(1, Number(it?.quantity) || 1);
        return sum + unitPrice * qty;
      }, 0);
    }
    return Number(combo.priceNumber) || 0;
  }

  comboStock(combo: ApiProduct): number {
    if (typeof combo.availableStock === 'number') return Math.max(0, combo.availableStock);
    if (typeof combo.stock === 'number') return Math.max(0, combo.stock);
    return 0;
  }

  isComboUnavailable(combo: ApiProduct): boolean {
    if (combo.comboStatus === 'paused' || combo.comboStatus === 'hidden') return true;
    return this.comboStock(combo) <= 0;
  }

  comboSaving(combo: ApiProduct): number {
    return Math.max(0, this.comboRetail(combo) - (combo.priceNumber || 0));
  }

  comboSavingPercent(combo: ApiProduct): number {
    const original = this.comboRetail(combo);
    return original > 0 ? Math.round((this.comboSaving(combo) / original) * 100) : 0;
  }

  money(value: number): string {
    return formatPrice(value);
  }

  addCombo(combo: ApiProduct): void {
    if (this.isComboUnavailable(combo)) return;
    this.cart.addItem(toCartProduct(combo), 1);
    this.addedComboId.set(combo._id);
    setTimeout(() => {
      if (this.addedComboId() === combo._id) this.addedComboId.set(null);
    }, 2000);
  }

  itemQty(slug: string): number {
    return this.cart.items().find(i => i.product.slug === slug && i.itemType !== 'addon')?.quantity ?? 0;
  }

  isAddOnSelected(addonId: string): boolean {
    return this.selectedAddOnIds().has(addonId);
  }

  toggleAddOn(addonId: string): void {
    this.selectedAddOnIds.update((set) => {
      const next = new Set(set);
      if (next.has(addonId)) {
        next.delete(addonId);
      } else {
        next.add(addonId);
        this.addOnQuantities.update((q) => ({ ...q, [addonId]: q[addonId] || 1 }));
      }
      return next;
    });
  }

  selectAllAddOns(): void {
    const allIds = this.availableAddOnDeals().map((c) => c.addonId);
    const current = this.selectedAddOnIds();
    if (allIds.length > 0 && allIds.every((id) => current.has(id))) {
      this.selectedAddOnIds.set(new Set());
    } else {
      const nextQ = { ...this.addOnQuantities() };
      for (const id of allIds) {
        if (!nextQ[id]) nextQ[id] = 1;
      }
      this.addOnQuantities.set(nextQ);
      this.selectedAddOnIds.set(new Set(allIds));
    }
  }

  getAddOnQty(addonId: string): number {
    return Math.max(1, this.addOnQuantities()[addonId] || 1);
  }

  changeAddOnQty(addonId: string, delta: number, event?: Event): void {
    event?.stopPropagation();
    event?.preventDefault();
    this.addOnQuantities.update((q) => {
      const cur = Math.max(1, q[addonId] || 1);
      return { ...q, [addonId]: Math.max(1, cur + delta) };
    });
    if (!this.selectedAddOnIds().has(addonId)) {
      this.selectedAddOnIds.update((s) => new Set([...s, addonId]));
    }
  }

  private buildSelectedAddOnEntries() {
    const selectedSet = this.selectedAddOnIds();
    const qtyMap = this.addOnQuantities();
    return this.availableAddOnDeals()
      .filter((c) => selectedSet.has(c.addonId))
      .map((c) => ({
        product: toCartProduct(c.addonProd),
        discountType: c.discountType,
        discountValue: c.discountValue,
        quantity: Math.max(1, qtyMap[c.addonId] || 1),
      }));
  }

  private currentSelectedOption(): string | undefined {
    return resolveProductOption(this.product(), this.selectedRipeness());
  }

  addSelectedBundleToCart(): void {
    const p = this.product();
    if (!p || this.isProductUnavailable(p)) return;
    const entries = this.buildSelectedAddOnEntries();
    if (entries.length === 0) {
      this.addToCart();
      return;
    }
    const ok = this.cart.addMainWithAddOns(
      toCartProduct(p),
      this.quantity(),
      this.currentSelectedOption(),
      entries,
      { openDrawer: true }
    );
    if (ok) {
      this.addedBundleNotice.set(true);
      setTimeout(() => this.addedBundleNotice.set(false), 2500);
    }
  }

  buySelectedBundleNow(): void {
    const p = this.product();
    if (!p || this.isProductUnavailable(p)) return;
    const entries = this.buildSelectedAddOnEntries();
    if (entries.length === 0) {
      this.buyNow();
      return;
    }
    this.cart.startDirectBundleBuyNow(toCartProduct(p), this.quantity(), this.currentSelectedOption(), entries);
    this.cart.closeCartDrawer();
    this.router.navigate(['/checkout'], { queryParams: { mode: 'buynow' } });
  }

  formatViewedTime(iso: string): string {
    if (!iso) return '';
    const time = new Date(iso).getTime();
    if (Number.isNaN(time)) return '';
    const diffSec = Math.max(0, Math.floor((Date.now() - time) / 1000));
    if (diffSec < 60) return 'Vừa xem';
    const diffMin = Math.floor(diffSec / 60);
    if (diffMin < 60) return `${diffMin} phút trước`;
    const diffHr = Math.floor(diffMin / 60);
    if (diffHr < 24) return `${diffHr} giờ trước`;
    const d = new Date(time);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
  }

  addOne(prod: ApiProduct, event?: Event): void {
    event?.stopPropagation();
    event?.preventDefault();
    const maxStock = prod.isCombo
      ? (prod.comboStatus === 'paused' || prod.comboStatus === 'hidden' ? 0 : (typeof prod.availableStock === 'number' ? prod.availableStock : prod.stock))
      : prod.stock;
    if (prod.isActive === false || (typeof maxStock === 'number' && maxStock <= 0)) return;
    this.cart.addItem(toCartProduct(prod), 1, prod.ripeness || 'Fresh');
  }

  removeOne(prod: ApiProduct, event?: Event): void {
    event?.stopPropagation();
    event?.preventDefault();
    const qty = this.itemQty(prod.slug);
    if (qty > 1) {
      this.cart.updateQuantity(prod.slug, qty - 1);
    } else {
      this.cart.removeItem(prod.slug);
    }
  }

  addRelatedToCart(p: ApiProduct, event?: Event): void {
    this.addOne(p, event);
  }

  getSpecKeys(specs: any): string[] {
    if (!specs || typeof specs !== 'object') return [];
    const ignored = new Set([
      'danh mục', 'danhmuc', 'category', 'đóng gói', 'donggoi', 'packaging',
      'sơ chế', 'soche', 'preparation', 'đặc tính', 'dactinh',
      'dung tích', 'dungtich', 'khối lượng', 'khoiluong', 'khối lượng tịnh', 'khoiluongtinh',
      'quy cách', 'quycach', 'trọng lượng', 'trongluong',
      'xuất xứ', 'xuatxu', 'origin', 'thương hiệu', 'thuonghieu', 'brand',
      'nhà sản xuất', 'nhasanxuat', 'hạn sử dụng', 'hansudung'
    ]);
    return Object.keys(specs).filter(k => !ignored.has(k.trim().toLowerCase()) && specs[k]);
  }

  getSpecValue(specs: any, key: string): string {
    return specs && typeof specs === 'object' && specs[key] ? String(specs[key]) : '';
  }

  getExpiry(specs?: Record<string, string>): string {
    return specs && specs['Hạn sử dụng'] ? specs['Hạn sử dụng'] : 'Xem trên bao bì sản phẩm';
  }

  productMaxStock(p: ApiProduct): number {
    if (p.isCombo) return Math.max(0, this.comboStock(p));
    return typeof p.stock === 'number' ? Math.max(0, Math.floor(p.stock)) : 0;
  }

  isProductUnavailable(p: ApiProduct): boolean {
    if (p.isCombo) return this.isComboUnavailable(p);
    return p.isActive === false || this.productMaxStock(p) <= 0;
  }

  dec(): void { this.quantity.update(q => Math.max(1, q - 1)); }
  inc(): void {
    const p = this.product();
    if (!p) return;
    const maxStock = this.productMaxStock(p);
    if (maxStock <= 0) return;
    this.quantity.update(q => Math.min(maxStock, q + 1));
  }

  toggleAccordion(k: 'info' | 'refund' | 'shipping'): void {
    this.openAccordions.update(o => ({ ...o, [k]: !o[k] }));
  }

  addToCart(): void {
    const p = this.product();
    if (!p || this.isProductUnavailable(p)) return;
    if (p.isCombo) {
      this.cart.addItem(toCartProduct(p), this.quantity());
      return;
    }
    const entries = this.buildSelectedAddOnEntries();
    if (entries.length > 0) {
      this.addSelectedBundleToCart();
      return;
    }
    this.cart.addItem(toCartProduct(p), this.quantity(), this.currentSelectedOption());
  }

  buyNow(): void {
    const p = this.product();
    if (!p || this.isProductUnavailable(p)) return;
    const entries = this.buildSelectedAddOnEntries();
    if (entries.length > 0) {
      this.buySelectedBundleNow();
      return;
    }
    this.cart.startDirectBuyNow(toCartProduct(p), this.quantity(), this.currentSelectedOption());
    this.cart.closeCartDrawer();
    this.router.navigate(['/checkout'], { queryParams: { mode: 'buynow' } });
  }

  // ── Review Methods ───────────────────────────────
  get reviews() {
    const p = this.product();
    if (!p) return [];
    return this.reviewService.filterReviews(p._id, this.reviewFilter());
  }

  get reviewStats() {
    const p = this.product();
    if (!p) return this.reviewService.getProductStats('');
    return this.reviewService.getProductStats(p._id);
  }

  setRating(rating: number): void {
    this.reviewRating.set(rating);
  }

  onReviewImagesSelected(event: Event): void {
    const input = event.target as HTMLInputElement | null;
    if (!input?.files?.length) return;

    const current = this.reviewImages();
    const remainingSlots = Math.max(0, 5 - current.length);
    if (remainingSlots <= 0) {
      alert('Bạn chỉ có thể đính kèm tối đa 5 hình ảnh cho mỗi đánh giá.');
      input.value = '';
      return;
    }

    const files = Array.from(input.files)
      .filter(f => f.type.startsWith('image/'))
      .slice(0, remainingSlots);

    for (const file of files) {
      if (file.size > 5 * 1024 * 1024) {
        alert(`Ảnh "${file.name}" vượt quá 5MB, vui lòng chọn ảnh nhẹ hơn.`);
        continue;
      }
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = typeof reader.result === 'string' ? reader.result : '';
        if (dataUrl && this.reviewImages().length < 5) {
          this.reviewImages.update(imgs => [...imgs, dataUrl]);
        }
      };
      reader.readAsDataURL(file);
    }

    input.value = '';
  }

  removeReviewImage(index: number): void {
    this.reviewImages.update(imgs => imgs.filter((_, i) => i !== index));
  }

  openImagePreview(url: string): void {
    if (url) this.previewImageUrl.set(url);
  }

  closeImagePreview(): void {
    this.previewImageUrl.set(null);
  }

  submitReview(): void {
    const p = this.product();
    if (!p || this.reviewRating() === 0 || !this.reviewContent()) return;

    // Cần đăng nhập: đánh giá được gắn với tài khoản (server lấy từ token)
    if (!this.cart.currentUser()) {
      this.cart.openAuthModal('login');
      return;
    }

    this.submittingReview.set(true);
    this.reviewService.addReview({
      productId: p._id,
      productName: p.name,
      productImage: p.image,
      rating: this.reviewRating(),
      title: this.reviewTitle(),
      content: this.reviewContent(),
      images: this.reviewImages(),
    }).subscribe({
      next: () => {
        this.submittingReview.set(false);
        this.showReviewForm.set(false);
        this.reviewRating.set(0);
        this.reviewTitle.set('');
        this.reviewContent.set('');
        this.reviewImages.set([]);
        this.reviewEligibility.set({
          canReview: false,
          hasReviewed: true,
          hasDeliveredOrder: true,
          hasPendingOrder: false,
          message: 'Bạn đã đánh giá sản phẩm này rồi.',
        });
        this.reviewNotice.set('Cảm ơn bạn đã đánh giá! Nhận xét của bạn đã được ghi nhận.');
      },
      error: (err) => {
        this.submittingReview.set(false);
        const errMsg = err?.error?.message || 'Không gửi được đánh giá, vui lòng thử lại.';
        this.reviewNotice.set(errMsg);
        alert(errMsg);
      },
    });
  }

  isReviewHelpful(review: any): boolean {
    return !!review.isHelpful || this.localHelpfulReviews().has(review.id);
  }

  markHelpful(reviewId: string): void {
    const p = this.product();
    if (!p) return;

    const currentSet = new Set(this.localHelpfulReviews());
    const isCurrentlyLiked = currentSet.has(reviewId);
    const action = isCurrentlyLiked ? 'unlike' : 'like';

    if (isCurrentlyLiked) {
      currentSet.delete(reviewId);
    } else {
      currentSet.add(reviewId);
    }
    this.localHelpfulReviews.set(currentSet);
    try {
      localStorage.setItem('xanhla_helpful_reviews', JSON.stringify(Array.from(currentSet)));
    } catch {}

    this.reviewService.markHelpful(reviewId, p._id, action).subscribe({
      error: () => { /* bỏ qua */ }
    });
  }

  setReviewFilter(filter: typeof this.reviewFilter extends (...args: any) => any ? ReturnType<typeof this.reviewFilter> : any): void {
    this.reviewFilter.set(filter);
  }

  getRatingCount(rating: number): number {
    return this.reviewStats.ratingDistribution[rating as keyof typeof this.reviewStats.ratingDistribution] || 0;
  }

  getRatingPercent(rating: number): number {
    const total = this.reviewStats.totalReviews;
    if (total === 0) return 0;
    return Math.round((this.getRatingCount(rating) / total) * 100);
  }

  readonly starsArray = [1, 2, 3, 4, 5];
}
