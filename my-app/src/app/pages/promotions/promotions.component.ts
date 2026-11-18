import { Component, OnInit, OnDestroy, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ShellComponent } from '../../components/shell/shell.component';
import { Router, RouterLink } from '@angular/router';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { VoucherService } from '../../shared/services/voucher.service';
import { CartService, formatPrice, resolveProductMaxStock } from '../../shared/services/cart.service';
import { ProductApiService, ApiProduct } from '../../shared/services/product-api.service';
import { FlashSaleApiService, FlashSaleItem } from '../../shared/services/flash-sale-api.service';
import { ApiService } from '../../shared/services/api.service';
import { Voucher, XanhLaProduct } from '../../shared/models/xanh-la.models';
import { buildVoucherVisual, VoucherCardVisual } from '../../shared/utils/voucher-visual.util';

export type CategoryFilterGroup = 'vegetables' | 'fruits' | 'meat' | 'dry';

export interface FlashDealCardView {
  id: string;
  name: string;
  slug: string;
  productLink: string;
  category: string;
  categoryGroup: CategoryFilterGroup;
  description: string;
  image: string;
  originalPrice: number;
  originalPriceText: string;
  flashSalePrice: number;
  flashSalePriceText: string;
  discountPercent: number;
  totalQuantity: number;
  soldQuantity: number;
  soldPercent: number;
  isSoldOut: boolean;
  stock?: number;
  cartProduct: XanhLaProduct;
}

export interface ComboDealItem {
  id: string;
  name: string;
  image: string;
  prepTime: string;
  badge: string;
  voucherCode: string;
  items: { name: string; unit: string; product: XanhLaProduct }[];
  originalTotal: number;
  originalTotalText: string;
  comboPrice: number;
  comboPriceText: string;
  savedText: string;
}

export interface FeaturedVoucherView {
  voucher: Voucher;
  visual: VoucherCardVisual;
}

function classifyCategoryText(text: string): CategoryFilterGroup {
  const lower = String(text || '').toLowerCase();
  if (
    lower.includes('fruit') ||
    lower.includes('trái cây') ||
    lower.includes('cam') ||
    lower.includes('táo') ||
    lower.includes('chuối') ||
    lower.includes('bơ') ||
    lower.includes('dâu') ||
    lower.includes('nho') ||
    lower.includes('xoài') ||
    lower.includes('ổi') ||
    lower.includes('dưa hấu')
  ) {
    return 'fruits';
  }
  if (
    lower.includes('meat') ||
    lower.includes('seafood') ||
    lower.includes('thịt') ||
    lower.includes('cá ') ||
    lower.includes('tôm') ||
    lower.includes('gà ') ||
    lower.includes('bò ') ||
    lower.includes('heo') ||
    lower.includes('trứng') ||
    lower.includes('hải sản')
  ) {
    return 'meat';
  }
  if (
    lower.includes('dry') ||
    lower.includes('spice') ||
    lower.includes('pantry') ||
    lower.includes('drink') ||
    lower.includes('gia vị') ||
    lower.includes('hạt') ||
    lower.includes('gạo') ||
    lower.includes('mật ong') ||
    lower.includes('sữa') ||
    lower.includes('nước') ||
    lower.includes('trà') ||
    lower.includes('dầu')
  ) {
    return 'dry';
  }
  return 'vegetables';
}

function toDealCartProduct(p: ApiProduct, dealPrice: number): XanhLaProduct {
  const rawSlug = (p.slug || p._id || '').trim();
  const productLink = rawSlug.startsWith('/') ? rawSlug : `/product-page/${rawSlug}`;
  return {
    id: p._id || p.slug,
    name: p.name,
    slug: productLink,
    price: formatPrice(dealPrice),
    priceNumber: dealPrice,
    image: p.image,
    category: p.categoryId || '',
    categoryVi: p.categoryVi || '',
    description: p.description || '',
    container: p.container || '',
    cutType: p.cutType || '',
    cutting: p.cutting || '',
    packSize: p.packSize || '',
    packaging: p.packaging || '',
    preparation: p.preparation || '',
    quantity: p.quantity || '',
    ripeness: p.ripeness || '',
    sizeGroup: p.sizeGroup || '',
    thickness: p.thickness || '',
    type: p.type || '',
    weight: p.weight || '',
    options: p.options,
    stock: typeof p.availableStock === 'number' ? p.availableStock : p.stock,
    availableStock: p.availableStock,
    comboStatus: p.comboStatus,
    isCombo: p.isCombo,
  };
}

@Component({
  selector: 'app-promotions',
  standalone: true,
  imports: [CommonModule, ShellComponent, RouterLink],
  templateUrl: './promotions.component.html',
  styleUrl: './promotions.component.css',
})
export class PromotionsComponent implements OnInit, OnDestroy {
  private router = inject(Router);
  private productApi = inject(ProductApiService);
  private flashSaleApi = inject(FlashSaleApiService);
  private api = inject(ApiService);
  protected voucher = inject(VoucherService);
  protected cart = inject(CartService);

  dealCategoryFilter = signal<'all' | CategoryFilterGroup>('all');

  dealsLoading = signal<boolean>(true);
  productDeals = signal<FlashDealCardView[]>([]);
  comboDeals = signal<ComboDealItem[]>([]);

  toastMessage = signal<string>('');
  private toastTimer: any = null;

  flashSaleCountdown = signal<string>('04:32:18');
  private countdownInterval: any = null;

  readonly filteredProductDeals = computed<FlashDealCardView[]>(() => {
    const filter = this.dealCategoryFilter();
    const all = this.productDeals();
    if (filter === 'all') return all;
    return all.filter((d) => d.categoryGroup === filter);
  });

  readonly dealFilterCounts = computed(() => {
    const all = this.productDeals();
    return {
      all: all.length,
      vegetables: all.filter((d) => d.categoryGroup === 'vegetables').length,
      fruits: all.filter((d) => d.categoryGroup === 'fruits').length,
      meat: all.filter((d) => d.categoryGroup === 'meat').length,
      dry: all.filter((d) => d.categoryGroup === 'dry').length,
    };
  });

  readonly featuredVouchers = computed<FeaturedVoucherView[]>(() =>
    this.voucher
      .publicVouchers()
      .slice(0, 3)
      .map((v, idx) => ({
        voucher: v,
        visual: buildVoucherVisual(v, idx),
      }))
  );

  ngOnInit(): void {
    this.voucher.loadPublic();
    this.voucher.refreshMine();
    this.loadFlashSalesAndCombos();
    this.startFlashCountdown();
  }

  ngOnDestroy(): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }
  }

  private startFlashCountdown(): void {
    const update = () => {
      const now = new Date();
      const currentHour = now.getHours();
      const nextSlotHour = Math.floor(currentHour / 6) * 6 + 6;
      const target = new Date(now);
      target.setHours(nextSlotHour, 0, 0, 0);
      const diffMs = target.getTime() - now.getTime();
      const totalSec = Math.max(0, Math.floor(diffMs / 1000));
      const hours = Math.floor(totalSec / 3600);
      const mins = Math.floor((totalSec % 3600) / 60);
      const secs = totalSec % 60;
      const pad = (n: number) => n.toString().padStart(2, '0');
      this.flashSaleCountdown.set(`${pad(hours)}:${pad(mins)}:${pad(secs)}`);
    };
    update();
    this.countdownInterval = setInterval(update, 1000);
  }

  private loadFlashSalesAndCombos(): void {
    this.dealsLoading.set(true);
    forkJoin({
      flashRes: this.flashSaleApi.getActive().pipe(catchError(() => of({ success: false, count: 0, data: [] as FlashSaleItem[] }))),
      prodRes: this.productApi.getAll({ limit: 500 }).pipe(catchError(() => of({ success: false, data: [] as ApiProduct[] }))),
    }).subscribe({
      next: ({ flashRes, prodRes }) => {
        const products = (prodRes.data || []).filter((p) => p.isActive !== false && p.priceNumber > 0);
        const liveMap = this.buildLiveProductMap(products);

        const activeFlashSales = flashRes.success && Array.isArray(flashRes.data) ? flashRes.data : [];
        this.productDeals.set(activeFlashSales.map((deal) => this.mapFlashSaleToView(deal, liveMap)));
        this.loadComboDealsFromMongo(products);
        this.dealsLoading.set(false);
      },
      error: () => {
        this.dealsLoading.set(false);
      },
    });
  }

  private buildLiveProductMap(products: ApiProduct[]): Map<string, ApiProduct> {
    const map = new Map<string, ApiProduct>();
    for (const p of products) {
      if (p._id) map.set(String(p._id), p);
      if (p.slug) {
        map.set(p.slug, p);
        const clean = p.slug.replace(/^\/product-page\//, '').replace(/^\//, '');
        if (clean) map.set(clean, p);
      }
    }
    return map;
  }

  private mapFlashSaleToView(deal: FlashSaleItem, liveMap: Map<string, ApiProduct>): FlashDealCardView {
    const cleanSlug = (deal.slug || '').replace(/^\/product-page\//, '').replace(/^\//, '');
    const live =
      liveMap.get(String(deal.productId || '')) ||
      liveMap.get(deal.slug || '') ||
      liveMap.get(cleanSlug);

    const liveStock = live
      ? live.isCombo && typeof live.availableStock === 'number'
        ? Math.max(0, Math.floor(live.availableStock))
        : typeof live.stock === 'number'
          ? Math.max(0, Math.floor(live.stock))
          : deal.stock
      : deal.stock;

    const isOutOfStock = Boolean(
      (live && live.isActive === false) ||
      (typeof liveStock === 'number' && liveStock <= 0)
    );
    const isSoldOut = Boolean(deal.isSoldOut || isOutOfStock);

    const productLink = cleanSlug
      ? `/product-page/${cleanSlug}`
      : deal.productId
        ? `/product-page/${deal.productId}`
        : '/online-ordering';

    const categoryText = deal.category || live?.categoryVi || live?.category || 'Nông sản sạch';
    const description = (deal.description || live?.description || '').trim();
    const salePrice = deal.flashSalePrice || 0;

    const cartProduct: XanhLaProduct = live
      ? toDealCartProduct({ ...live, stock: liveStock ?? live.stock }, salePrice)
      : ({
          id: deal.productId || deal._id,
          name: deal.name,
          slug: cleanSlug || deal._id,
          price: formatPrice(salePrice),
          priceNumber: salePrice,
          image: deal.image,
          category: 'Vegetables',
          categoryVi: categoryText,
          description,
          stock: liveStock,
        } as XanhLaProduct);

    return {
      id: deal._id || deal.productId,
      name: deal.name,
      slug: cleanSlug,
      productLink,
      category: categoryText,
      categoryGroup: classifyCategoryText(`${categoryText} ${deal.name}`),
      description,
      image: deal.image,
      originalPrice: deal.originalPrice || 0,
      originalPriceText: formatPrice(deal.originalPrice || 0),
      flashSalePrice: salePrice,
      flashSalePriceText: formatPrice(salePrice),
      discountPercent: deal.discountPercent || 0,
      totalQuantity: deal.totalQuantity || 0,
      soldQuantity: deal.soldQuantity || 0,
      soldPercent: deal.soldPercent || 0,
      isSoldOut,
      stock: liveStock,
      cartProduct,
    };
  }

  isDealOutOfStock(deal: FlashDealCardView): boolean {
    return typeof deal.stock === 'number' && deal.stock <= 0;
  }

  private loadComboDealsFromMongo(products: ApiProduct[]): void {
    this.api.get<{ success: boolean; data: any }>('/nutrition').subscribe({
      next: (res) => {
        const recipes = Array.isArray(res.data) ? res.data : res.data?.recipes || [];
        const combos: ComboDealItem[] = recipes.slice(0, 6).map((r: any, idx: number) => {
          const matchedItems: { name: string; unit: string; product: XanhLaProduct }[] = [];
          for (const ing of r.ingredients || []) {
            const p =
              products.find(
                (prod) =>
                  prod.name.toLowerCase().includes(ing.name.toLowerCase()) ||
                  ing.name.toLowerCase().includes(prod.name.toLowerCase())
              ) || products[(idx * 3 + matchedItems.length) % Math.max(1, products.length)];
            if (p) {
              matchedItems.push({
                name: p.name,
                unit: `${ing.amountPer1Serving * 2}${ing.unit}`,
                product: toDealCartProduct(p, Math.round((p.priceNumber * 0.8) / 500) * 500),
              });
            }
          }

          const originalTotal = matchedItems.reduce((sum, item) => {
            const origProd = products.find((p) => (p._id || p.slug) === item.product.id);
            return sum + (origProd?.priceNumber || item.product.priceNumber);
          }, 0);
          const comboPrice = Math.round((originalTotal * 0.78) / 1000) * 1000;
          const saved = Math.max(0, originalTotal - comboPrice);

          return {
            id: r.id || r.recipeId || `combo-${idx}`,
            name: `Combo ${r.name}`,
            image: r.image,
            prepTime: r.prepTime || '25 phút',
            badge: 'Tiết kiệm 22%',
            voucherCode: idx % 2 === 0 ? 'COMBO30' : 'NUTRITION10',
            items: matchedItems,
            originalTotal,
            originalTotalText: formatPrice(originalTotal),
            comboPrice,
            comboPriceText: formatPrice(comboPrice),
            savedText: formatPrice(saved),
          };
        });
        this.comboDeals.set(combos);
      },
      error: () => {},
    });
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement | null;
    if (img && !img.dataset['fallbackApplied']) {
      img.dataset['fallbackApplied'] = '1';
      img.src = 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=700&q=80';
    }
  }

  addDealToCart(deal: FlashDealCardView, event?: Event): void {
    if (deal.isSoldOut || this.isDealOutOfStock(deal)) {
      this.showToast(`"${deal.name}" hiện đã tạm hết hàng.`);
      return;
    }
    if (event) {
      this.cart.animateFlyToCart(event, deal.image);
    }
    this.cart.addItem(deal.cartProduct, 1);
    this.showToast(`Đã thêm "${deal.name}" (Giá Flash Sale ${deal.flashSalePriceText}) vào giỏ hàng!`);
  }

  openBuyNowDeal(deal: FlashDealCardView): void {
    if (deal.isSoldOut || this.isDealOutOfStock(deal)) return;
    this.cart.openBuyNowModal(deal.cartProduct);
  }

  addComboToCart(combo: ComboDealItem): void {
    const available = combo.items.filter((item) => resolveProductMaxStock(item.product) !== 0);
    if (available.length === 0) {
      this.showToast(`Các nguyên liệu trong combo "${combo.name}" hiện đang tạm hết hàng.`);
      return;
    }
    for (const item of available) {
      this.cart.addItem(item.product, 1);
    }
    this.voucher.copyCode(combo.voucherCode);
    const suffix =
      available.length < combo.items.length
        ? ` (đã thêm ${available.length}/${combo.items.length} món còn hàng)`
        : '';
    this.showToast(`Đã thêm trọn bộ "${combo.name}"${suffix} vào giỏ hàng và sao chép mã ${combo.voucherCode}!`);
  }

  private showToast(msg: string): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastMessage.set(msg);
    this.toastTimer = setTimeout(() => this.toastMessage.set(''), 4500);
  }

  scrollToSection(sectionId: string): void {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  goToLoyalty(): void {
    this.router.navigate(['/loyalty']);
  }
}
