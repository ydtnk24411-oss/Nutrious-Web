import { Component, OnInit, OnDestroy, computed, effect, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ShellComponent } from '../../components/shell/shell.component';
import { Router, RouterLink } from '@angular/router';
import { VoucherService } from '../../shared/services/voucher.service';
import { CartService, formatPrice } from '../../shared/services/cart.service';
import { ProductApiService, ApiProduct } from '../../shared/services/product-api.service';
import { ApiService } from '../../shared/services/api.service';
import { Voucher, XanhLaProduct } from '../../shared/models/xanh-la.models';

export interface PromoItem {
  id: string;
  voucherId: string;
  title: string;
  desc: string;
  badge: string;
  expiry: string;
  tag: string;
  cta: string;
  code: string;
  minOrderValue: number;
  discountType: 'percentage' | 'fixed' | 'freeship' | 'category';
  discountText: string;
  color: 'green' | 'amber' | 'teal' | 'rose';
  action: 'vouchers' | 'loyalty' | 'shop' | 'nutrition' | 'checkout';
  queryParams?: Record<string, string>;
}

export interface ProductDealItem {
  id: string;
  name: string;
  image: string;
  productLink: string;
  categoryGroup: 'vegetables' | 'fruits' | 'meat' | 'dry';
  categoryLabel: string;
  unitLabel: string;
  originalPrice: number;
  originalPriceText: string;
  dealPrice: number;
  dealPriceText: string;
  discountPercent: number;
  savedAmountText: string;
  dealTag: string;
  soldCount: number;
  totalQuota: number;
  soldPercent: number;
  cartProduct: XanhLaProduct;
}

export interface ComboDealItem {
  id: string;
  name: string;
  image: string;
  description: string;
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

const CARD_THEMES: { color: 'green' | 'amber' | 'teal' | 'rose' }[] = [
  { color: 'green' },
  { color: 'amber' },
  { color: 'teal' },
  { color: 'rose' },
];

const DEAL_DISCOUNTS = [25, 20, 30, 15, 35, 20, 25, 18, 30, 22, 15, 28];
const DEAL_TAGS = [
  'Flash Sale Hôm Nay',
  'Nông Sản Đà Lạt',
  'Giá Tốt Mỗi Ngày',
  'Ưu Đãi Hữu Cơ',
  'Tươi Ngon Trong Ngày',
  'Mua Nhiều Giảm Sâu',
];

function classifyCategory(p: ApiProduct): { group: 'vegetables' | 'fruits' | 'meat' | 'dry'; label: string } {
  const text = `${p.categoryId || ''} ${p.category || ''} ${p.categoryVi || ''} ${p.name || ''}`.toLowerCase();
  if (text.includes('fruit') || text.includes('trái cây') || text.includes('cam') || text.includes('táo') || text.includes('chuối') || text.includes('bơ') || text.includes('dâu') || text.includes('nho') || text.includes('xoài') || text.includes('ổi') || text.includes('dưa hấu')) {
    return { group: 'fruits', label: 'Trái cây tươi' };
  }
  if (text.includes('meat') || text.includes('seafood') || text.includes('thịt') || text.includes('cá ') || text.includes('tôm') || text.includes('gà ') || text.includes('bò ') || text.includes('heo') || text.includes('trứng')) {
    return { group: 'meat', label: 'Thịt & Hải sản' };
  }
  if (text.includes('dry') || text.includes('spice') || text.includes('drink') || text.includes('hạt') || text.includes('gạo') || text.includes('mật ong') || text.includes('sữa') || text.includes('nước ép') || text.includes('trà') || text.includes('dầu')) {
    return { group: 'dry', label: 'Thực phẩm khô & Đồ uống' };
  }
  return { group: 'vegetables', label: 'Rau củ hữu cơ' };
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
  private api = inject(ApiService);
  protected voucher = inject(VoucherService);
  protected cart = inject(CartService);

  activeTab = signal<'vouchers' | 'points'>('vouchers');
  walletFilter = signal<'all' | 'saved'>('all');
  voucherCategoryFilter = signal<'all' | 'percentage' | 'fixed' | 'low_min'>('all');
  dealCategoryFilter = signal<'all' | 'vegetables' | 'fruits' | 'meat' | 'dry'>('all');

  dealsLoading = signal<boolean>(true);
  productDeals = signal<ProductDealItem[]>([]);
  comboDeals = signal<ComboDealItem[]>([]);

  toastMessage = signal<string>('');
  private pendingVoucherId = signal<string | null>(null);

  // Live Flash Sale Countdown
  flashSaleCountdown = signal<string>('04:32:18');
  private countdownInterval: any = null;

  // Dynamically computed promotions from MongoDB vouchers
  readonly promotions = computed<PromoItem[]>(() => {
    const list = this.voucher.publicVouchers();
    return list.map((v, idx) => {
      const theme = CARD_THEMES[idx % CARD_THEMES.length];
      const isPercent = v.type === 'percentage';
      const discountText = isPercent
        ? `Giảm ${v.value}%`
        : `Giảm ${v.value.toLocaleString('vi-VN')}đ`;

      return {
        id: v.id,
        voucherId: v.id,
        title: v.name,
        desc: v.description || `${discountText} cho đơn hàng từ ${(v.minValue || 0).toLocaleString('vi-VN')}đ.`,
        badge: isPercent ? `-${v.value}%` : `-${Math.round(v.value / 1000)}K`,
        expiry: `HSD: ${v.endDate}`,
        tag: (v.minValue || 0) > 0 ? `Đơn từ ${(v.minValue || 0).toLocaleString('vi-VN')}đ` : 'Mọi đơn hàng',
        cta: 'Dùng ưu đãi này',
        code: v.code,
        minOrderValue: v.minValue || 0,
        discountType: v.type,
        discountText,
        color: theme.color,
        action: 'checkout',
        queryParams: { voucher: v.code },
      };
    });
  });

  readonly filteredPromotions = computed<PromoItem[]>(() => {
    const filter = this.voucherCategoryFilter();
    const all = this.promotions();
    if (filter === 'percentage') return all.filter(p => p.discountType === 'percentage');
    if (filter === 'fixed') return all.filter(p => p.discountType === 'fixed');
    if (filter === 'low_min') return all.filter(p => p.minOrderValue <= 150000);
    return all;
  });

  readonly voucherFilterCounts = computed(() => {
    const all = this.promotions();
    return {
      all: all.length,
      percentage: all.filter(p => p.discountType === 'percentage').length,
      fixed: all.filter(p => p.discountType === 'fixed').length,
      lowMin: all.filter(p => p.minOrderValue <= 150000).length,
    };
  });

  readonly filteredProductDeals = computed<ProductDealItem[]>(() => {
    const filter = this.dealCategoryFilter();
    const all = this.productDeals();
    if (filter === 'all') return all.slice(0, 8);
    return all.filter(d => d.categoryGroup === filter).slice(0, 8);
  });

  readonly filteredWalletVouchers = computed<Voucher[]>(() => {
    if (this.walletFilter() === 'saved') {
      return this.voucher.availableVouchers().map(uv => uv.voucher);
    }
    return this.voucher.publicVouchers();
  });

  constructor() {
    effect(() => {
      const user = this.cart.currentUser();
      const pendingId = this.pendingVoucherId();
      if (user && pendingId) {
        this.pendingVoucherId.set(null);
        this.persistVoucher(pendingId);
      }
    });
  }

  ngOnInit(): void {
    this.voucher.loadPublic();
    this.voucher.refreshMine();
    this.loadDealsFromMongo();
    this.startFlashCountdown();
  }

  ngOnDestroy(): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
  }

  private startFlashCountdown(): void {
    const update = () => {
      const now = new Date();
      // Calculate remaining time until next 6-hour slot (06:00, 12:00, 18:00, 24:00)
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

  private loadDealsFromMongo(): void {
    this.dealsLoading.set(true);
    this.productApi.getAll({ limit: 0 }).subscribe({
      next: (res) => {
        const products = (res.data || []).filter(p => p.isActive !== false && p.priceNumber > 0);
        this.buildProductDeals(products);
        this.loadComboDealsFromMongo(products);
        this.dealsLoading.set(false);
      },
      error: () => {
        this.dealsLoading.set(false);
      },
    });
  }

  onImageError(event: Event): void {
    const img = event.target as HTMLImageElement | null;
    if (img && !img.dataset['fallbackApplied']) {
      img.dataset['fallbackApplied'] = '1';
      img.src = 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=700&q=80';
    }
  }

  private buildProductDeals(products: ApiProduct[]): void {
    // Pick balanced products across categories for Flash Sale / Daily Deals
    const byGroup: Record<'vegetables' | 'fruits' | 'meat' | 'dry', ApiProduct[]> = {
      vegetables: [],
      fruits: [],
      meat: [],
      dry: [],
    };
    for (const p of products) {
      const { group } = classifyCategory(p);
      if (byGroup[group].length < 6) {
        byGroup[group].push(p);
      }
    }

    const interleaved: ApiProduct[] = [];
    const maxLen = Math.max(
      byGroup.vegetables.length,
      byGroup.fruits.length,
      byGroup.meat.length,
      byGroup.dry.length
    );
    for (let i = 0; i < maxLen; i++) {
      if (byGroup.vegetables[i]) interleaved.push(byGroup.vegetables[i]);
      if (byGroup.fruits[i]) interleaved.push(byGroup.fruits[i]);
      if (byGroup.meat[i]) interleaved.push(byGroup.meat[i]);
      if (byGroup.dry[i]) interleaved.push(byGroup.dry[i]);
    }

    const deals: ProductDealItem[] = interleaved.slice(0, 16).map((p, idx) => {
      const { group, label } = classifyCategory(p);
      const discountPercent = DEAL_DISCOUNTS[idx % DEAL_DISCOUNTS.length];
      // Round deal price to nearest 500đ
      const rawDeal = Math.round((p.priceNumber * (100 - discountPercent)) / 100 / 500) * 500;
      const dealPrice = Math.max(5000, rawDeal);
      const savedAmount = Math.max(0, p.priceNumber - dealPrice);
      const totalQuota = 25 + (idx % 4) * 5;
      const soldCount = Math.min(totalQuota - 3, 12 + ((idx * 3) % 14));
      const soldPercent = Math.round((soldCount / totalQuota) * 100);
      const rawSlug = (p.slug || p._id || '').trim();
      const productLink = rawSlug.startsWith('/') ? rawSlug : `/product-page/${rawSlug}`;

      return {
        id: p._id || p.slug,
        name: p.name,
        image: p.image,
        productLink,
        categoryGroup: group,
        categoryLabel: label,
        unitLabel: p.weight || p.packSize || p.quantity || 'Gói tiêu chuẩn',
        originalPrice: p.priceNumber,
        originalPriceText: p.price || formatPrice(p.priceNumber),
        dealPrice,
        dealPriceText: formatPrice(dealPrice),
        discountPercent,
        savedAmountText: formatPrice(savedAmount),
        dealTag: DEAL_TAGS[idx % DEAL_TAGS.length],
        soldCount,
        totalQuota,
        soldPercent,
        cartProduct: toDealCartProduct(p, dealPrice),
      };
    });

    this.productDeals.set(deals);
  }

  private loadComboDealsFromMongo(products: ApiProduct[]): void {
    this.api.get<{ success: boolean; data: any }>('/nutrition').subscribe({
      next: (res) => {
        const recipes = Array.isArray(res.data) ? res.data : (res.data?.recipes || []);
        const combos: ComboDealItem[] = recipes.slice(0, 6).map((r: any, idx: number) => {
          const matchedItems: { name: string; unit: string; product: XanhLaProduct }[] = [];
          for (const ing of r.ingredients || []) {
            const p = products.find(
              prod =>
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
            const origProd = products.find(p => (p._id || p.slug) === item.product.id);
            return sum + (origProd?.priceNumber || item.product.priceNumber);
          }, 0);
          const comboPrice = Math.round((originalTotal * 0.78) / 1000) * 1000;
          const saved = Math.max(0, originalTotal - comboPrice);

          return {
            id: r.id || r.recipeId || `combo-${idx}`,
            name: `Combo ${r.name}`,
            image: r.image,
            description: r.description,
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

  addDealToCart(deal: ProductDealItem): void {
    this.cart.addItem(deal.cartProduct, 1);
    this.showToast(`Đã thêm "${deal.name}" (Giá Deal ${deal.dealPriceText}) vào giỏ hàng!`);
  }

  addComboToCart(combo: ComboDealItem): void {
    for (const item of combo.items) {
      this.cart.addItem(item.product, 1);
    }
    this.voucher.copyCode(combo.voucherCode);
    this.showToast(`Đã thêm trọn bộ "${combo.name}" vào giỏ hàng và sao chép mã ${combo.voucherCode}!`);
  }

  setTab(tab: 'vouchers' | 'points'): void {
    this.activeTab.set(tab);
  }

  isCopied(code: string): boolean {
    return this.voucher.isCopied(code);
  }

  isSaved(voucherId?: string): boolean {
    if (!voucherId) return false;
    return this.voucher.isSaved(voucherId);
  }

  copyPromoCode(code: string, event: Event): void {
    event.stopPropagation();
    this.voucher.copyCode(code);
    this.showToast(`Đã sao chép mã ${code}! Mã vẫn được giữ hiển thị để bạn dễ đối chiếu hoặc chọn khi thanh toán.`);
  }

  savePromoVoucher(voucherId: string | undefined, event: Event): void {
    event.stopPropagation();
    if (!voucherId) return;
    if (this.isSaved(voucherId)) return;

    if (!this.cart.currentUser()) {
      this.pendingVoucherId.set(voucherId);
      this.cart.openAuthModal('login');
      return;
    }
    this.persistVoucher(voucherId);
  }

  private persistVoucher(voucherId: string): void {
    this.voucher.collectVoucher(voucherId).subscribe((res) => {
      if (res.success) {
        this.showToast('Đã lưu voucher vào Ví Voucher của bạn! Bạn có thể chọn trực tiếp khi thanh toán.');
      } else {
        this.showToast(res.message || 'Không thể lưu voucher lúc này.');
      }
    });
  }

  private showToast(msg: string): void {
    this.toastMessage.set(msg);
  }

  scrollToSection(sectionId: string): void {
    const el = document.getElementById(sectionId);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }

  goToVouchers(): void {
    this.router.navigate(['/vouchers']);
  }

  goToLoyalty(): void {
    this.router.navigate(['/loyalty']);
  }

  handlePromoAction(promo: PromoItem): void {
    if (promo.action === 'checkout') {
      this.router.navigate(['/checkout'], {
        queryParams: promo.queryParams || { voucher: promo.code },
      });
    } else if (promo.action === 'vouchers') {
      this.router.navigate(['/vouchers']);
    } else if (promo.action === 'loyalty') {
      this.router.navigate(['/loyalty']);
    } else if (promo.action === 'nutrition') {
      this.router.navigate(['/nutrition']);
    } else {
      this.router.navigate(['/online-ordering'], {
        queryParams: promo.queryParams || {},
      });
    }
  }
}
