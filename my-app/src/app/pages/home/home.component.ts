import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { Component, HostListener, OnDestroy, OnInit, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ShellComponent } from '../../components/shell/shell.component';
import { CartService, formatPrice } from '../../shared/services/cart.service';
import { ProductApiService, ApiProduct } from '../../shared/services/product-api.service';
import { heroImage, originImage } from '../../shared/data/xanh-la.data';
import { Voucher as ApiVoucher, XanhLaProduct } from '../../shared/models/xanh-la.models';
import { API_BASE } from '../../shared/services/api.service';
import { CategoryApiService, ApiCategory } from '../../shared/services/category-api.service';
import { VoucherService } from '../../shared/services/voucher.service';
import { FlashSaleApiService, FlashSaleItem } from '../../shared/services/flash-sale-api.service';

interface Deal {
  id: string; name: string; category: string; description: string; image: string;
  priceNew: string; priceOld: string; discountPct: number; save: string;
}
interface Voucher {
  id: string; code: string; title: string; value: string; valueShort: string; expiry: string;
  color: 'green' | 'amber' | 'red';
}
interface NewsItem { title: string; image: string; path: string; date: string; }

export interface HeroBannerSlide {
  image: string;
  link?: string;
  alt?: string;
  eyebrow?: string;
  title?: string;
  subtitle?: string;
  cta?: string;
}

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, ShellComponent, RouterLink],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent implements OnInit, OnDestroy {
  private http = inject(HttpClient);
  private cart = inject(CartService);
  private productApi = inject(ProductApiService);
  private categoryApi = inject(CategoryApiService);
  private voucherService = inject(VoucherService);
  private flashSaleApi = inject(FlashSaleApiService);

  readonly heroImage = heroImage;
  readonly originImage = originImage;
  readonly fallbackProductImage = 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=700&q=80';

  // =========================================================================
  // 1. DANH SÁCH BANNER CHÍNH (SLIDER) - 100% ẢNH NÔNG SẢN & THỰC PHẨM SẮC NÉT
  // Tích hợp đầy đủ thông tin: nhãn chứng nhận, tiêu đề, mô tả và nút bấm
  // =========================================================================
  private readonly defaultHeroBanners: HeroBannerSlide[] = [
    {
      image: '/images/banners/banner-fresh-vegetables.jpg',
      eyebrow: 'NÔNG SẢN HỮU CƠ ĐÀ LẠT',
      title: 'Rau củ thuần khiết thu hoạch sớm mai',
      subtitle: 'Nguồn nông sản hữu cơ VietGAP tươi mới mỗi ngày, trọn vẹn vị lành nguyên bản cho bữa cơm gia đình.',
      cta: 'Khám phá ngay',
      link: '/online-ordering',
      alt: 'Rau củ hữu cơ thuần khiết thu hoạch sớm mai'
    },
    {
      image: '/images/banners/banner-seafood-salmon.jpg',
      eyebrow: 'HẢI SẢN CAO CẤP NHẬP KHẨU',
      title: 'Cá hồi Na Uy tươi rói chuẩn vị biển',
      subtitle: 'Phi lê cá hồi thượng hạng giữ lạnh 0-2°C, ngọt mềm từng thớ thịt béo ngậy giàu dưỡng chất.',
      cta: 'Xem hải sản',
      link: '/online-ordering',
      alt: 'Cá hồi Na Uy tươi rói chuẩn vị biển tự nhiên'
    },
    {
      image: '/images/banners/banner-seafood-ice.jpg',
      eyebrow: 'ĐÁNH BẮT TRONG NGÀY - ƯỚP ĐÁ LẠNH',
      title: 'Tôm sú & cá biển tươi sống ướp đá',
      subtitle: 'Hải sản tươi sống ướp đá tự nhiên cập bến sớm, giữ trọn độ giòn ngọt thanh lành từ biển mẹ.',
      cta: 'Đặt hàng ngay',
      link: '/online-ordering',
      alt: 'Tôm sú và cá biển tươi sống ướp đá tự nhiên'
    },
    {
      image: '/images/banners/banner-salmon-dish.jpg',
      eyebrow: 'ẨM THỰC DINH DƯỠNG LÀNH MẠNH',
      title: 'Bữa ăn cân bằng nâng niu sức khỏe',
      subtitle: 'Cá hồi áp chảo thanh vị cùng rau củ hữu cơ, tính toán calorie và vi chất thanh sạch chuẩn khoa học.',
      cta: 'Xem thực đơn',
      link: '/nutrition',
      alt: 'Bữa ăn cân bằng dinh dưỡng nâng niu sức khỏe'
    },
    {
      image: '/images/banners/banner-fresh-fruits.jpg',
      eyebrow: 'VƯỜN TRÁI CÂY NHIỆT ĐỚI TƯƠI MỌNG',
      title: 'Hương sắc thiên nhiên ngọt lành mỗi ngày',
      subtitle: 'Dâu tây Đà Lạt, kiwi, chuối, nho mọng nước chín cây, thanh mát bổ sung vitamin tự nhiên.',
      cta: 'Chọn trái cây',
      link: '/promotions',
      alt: 'Trái cây nhiệt đới ngọt lành tươi mọng'
    },
    {
      image: '/images/banners/banner-spices-spoons.jpg',
      eyebrow: 'GIA VỊ THẢO MỘC THIÊN NHIÊN',
      title: 'Tinh hoa thảo mộc đượm vị cơm nhà',
      subtitle: 'Tiêu rừng, quế chi, hoa hồi 100% tự nhiên đánh thức hương vị cơm mẹ nấu ấm áp đậm đà.',
      cta: 'Xem gia vị',
      link: '/cook-with-what-you-have',
      alt: 'Gia vị thảo mộc thiên nhiên đượm vị cơm nhà'
    },
    {
      image: '/images/banners/banner-nam-o-sauce.jpg',
      eyebrow: 'ĐẶC SẢN LÀNG NGHỀ TRĂM NĂM',
      title: 'Nước mắm Nam Ô truyền thống đượm tình',
      subtitle: 'Ủ chượp thủ công từ cá cơm than vịnh Đà Nẵng và muối hạt tinh khiết, lắng đọng từng giọt ngọc biển.',
      cta: 'Mua đặc sản',
      link: '/category/all-products',
      alt: 'Nước mắm Nam Ô truyền thống đậm đà vị biển mẹ'
    },
    {
      image: '/images/banners/banner-spices-bowls.jpg',
      eyebrow: 'BỘ SƯU TẬP GIA VỊ THƯỢNG HẠNG',
      title: 'Gia vị thuần khiết cho bếp Việt an tâm',
      subtitle: 'Nghệ vàng, ớt khô, tiêu sọ xay nguyên chất, bảo đảm an toàn tuyệt đối không phụ gia bảo quản.',
      cta: 'Khám phá ngay',
      link: '/cook-with-what-you-have',
      alt: 'Bộ sưu tập gia vị thuần khiết cho bếp Việt'
    }
  ];

  private readonly heroBannersSignal = signal<HeroBannerSlide[]>(
    [...this.defaultHeroBanners]
  );
  private readonly activeHeroSignal = signal(0);

  get heroBanners(): HeroBannerSlide[] {
    return this.heroBannersSignal();
  }

  set heroBanners(slides: HeroBannerSlide[]) {
    this.heroBannersSignal.set(slides);
  }

  // =========================================================================
  // 2. HAI BANNER PHỤ BÊN PHẢI (ẢNH THƯƠNG HIỆU SẮC NÉT CHUẨN THỰC PHẨM)
  // =========================================================================
  sideBanners = {
    top: {
      image: '/images/banners/banner-maggi.jpg',
      link: '/promotions',
      alt: 'Chốt quà Maggi thăng vị hè tươi mát'
    },
    bottom: {
      image: '/images/banners/banner-chinsu-pepper.jpg',
      link: '/online-ordering',
      alt: 'Tiêu đen Chin-Su rắc tiêu thơm cơm đậm tình'
    }
  };

  get heroSlides() {
    return this.heroBanners;
  }

  get activeHero(): number {
    return this.activeHeroSignal();
  }

  set activeHero(index: number) {
    this.activeHeroSignal.set(index);
  }

  private heroTimer: ReturnType<typeof setInterval> | null = null;
  private lastBannerSyncAt = 0;

  promoPopup = signal<any | null>(null);
  showPromoPopup = signal(false);

  closePromoPopup(): void {
    this.showPromoPopup.set(false);
    try {
      sessionStorage.setItem('dismiss_promo_popup', 'true');
    } catch { }
  }

  // =========================================================================
  // 3. DANH MỤC SẢN PHẨM: LOAD 100% ĐỘNG TỪ MONGODB (KHÔNG HARDCODE)
  // =========================================================================
  private readonly backendOrigin = API_BASE.replace(/\/api\/?$/, '');
  categories: ApiCategory[] = [];
  loadingCategories = true;
  fallbackCategoryImage = '/images/categories/cat-rau-cu-trai-cay.png';

  resolveMediaUrl(raw?: string): string {
    const clean = (raw || '').trim();
    if (!clean) return '';
    if (clean.startsWith('/api/')) return `${this.backendOrigin}${clean}`;
    if (clean.startsWith('api/')) return `${this.backendOrigin}/${clean}`;
    return clean;
  }

  onHeroImageError(event: Event): void {
    const imgEl = event.target as HTMLImageElement;
    if (!imgEl) return;

    const currentSrc = imgEl.getAttribute('src') || imgEl.src || '';
    if (currentSrc.includes('/api/banners/media/') && !imgEl.dataset['retriedMedia']) {
      imgEl.dataset['retriedMedia'] = '1';
      const separator = currentSrc.includes('?') ? '&' : '?';
      imgEl.src = `${currentSrc}${separator}_r=${Date.now()}`;
      return;
    }

    const fallback = this.defaultHeroBanners[0].image;
    if (!currentSrc.includes(fallback)) {
      imgEl.src = fallback;
    }
  }

  onCatImageError(event: Event, rawImage?: string) {
    const imgEl = event.target as HTMLImageElement;
    if (!imgEl) return;

    const clean = (rawImage || '').trim();
    if (clean.startsWith('/') && !imgEl.dataset['triedBackend']) {
      imgEl.dataset['triedBackend'] = '1';
      imgEl.src = `${this.backendOrigin}${clean}`;
      return;
    }

    if (!imgEl.src.includes(this.fallbackCategoryImage)) {
      imgEl.src = this.fallbackCategoryImage;
    }
  }

  trackByCatId(_index: number, cat: ApiCategory): string {
    return cat._id;
  }
  readonly vouchers = computed<Voucher[]>(() => this.voucherService.publicVouchers().slice(0, 6).map((voucher, index) => ({
    id: voucher.id,
    code: voucher.code,
    title: voucher.name,
    value: voucher.description || this.voucherDescription(voucher),
    valueShort: voucher.type === 'percentage' ? `${voucher.value}%` : `${Math.round(voucher.value / 1000)}K`,
    expiry: `HSD: ${voucher.endDate}`,
    color: (['green', 'amber', 'red'] as const)[index % 3],
  })));
  readonly voucherToast = signal('');
  private voucherToastTimer: ReturnType<typeof setTimeout> | null = null;
  private pendingVoucherId = signal<string | null>(null);

  showVoucherToast(msg: string): void {
    this.voucherToast.set(msg);
    if (this.voucherToastTimer) clearTimeout(this.voucherToastTimer);
    if (msg) {
      this.voucherToastTimer = setTimeout(() => this.voucherToast.set(''), 4500);
    }
  }

  flashSales: FlashSaleItem[] = [];
  loadingFlashSales = true;
  private liveProductMap = new Map<string, ApiProduct>();
  readonly newsItems: NewsItem[] = [
    { title: 'Mẹo chọn rau củ tươi ngon cho cả tuần', image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=900&q=85', path: '/cam-nang/meo-chon-rau-cu-tuoi-ngon', date: 'CẨM NANG MUA SẮM' },
    { title: 'Gợi ý thực đơn nhanh gọn cho ngày bận rộn', image: 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=85', path: '/cam-nang/thuc-don-nhanh-gon-ngay-ban-ron', date: 'CẢM HỨNG GIAN BẾP' },
    { title: 'Sắp xếp căn bếp gọn gàng, dễ tìm nguyên liệu', image: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=900&q=85', path: '/cam-nang/sap-xep-can-bep-gon-gang', date: 'SỐNG TIỆN NGHI' },
  ];

  apiProducts: ApiProduct[] = [];
  loadingProducts = true;
  productOffset = 0;
  countdown = { hours: '05', minutes: '42', seconds: '18' };
  private countdownEnd = Date.now() + 5 * 60 * 60 * 1000 + 42 * 60 * 1000 + 18000;
  private countdownTimer: ReturnType<typeof setInterval> | null = null;

  constructor() {
    effect(() => {
      const user = this.cart.currentUser();
      const voucherId = this.pendingVoucherId();
      if (user && voucherId) {
        this.pendingVoucherId.set(null);
        this.persistVoucher(voucherId);
      }
    });
  }

  get visibleProducts(): ApiProduct[] { return this.apiProducts.slice(this.productOffset, this.productOffset + 4); }

  @HostListener('window:focus')
  onWindowFocus(): void {
    this.loadBanners(true);
  }

  @HostListener('document:visibilitychange')
  onVisibilityChange(): void {
    if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
      this.loadBanners(true);
    }
  }

  loadBanners(isRefresh = false): void {
    const now = Date.now();
    if (isRefresh && now - this.lastBannerSyncAt < 1500) {
      return;
    }
    this.lastBannerSyncAt = now;

    this.http.get<any>(`${API_BASE}/banners`, { params: { _t: String(now) } }).subscribe({
      next: (res) => {
        if (res && res.success && res.data) {
          const legacyBlacklist = [
            '9-9',
            'hoi-vien',
            'thuc-pham-sach',
            'banner-9-9',
            'banner-uu-dai-hoi-vien',
            '6afe009e20f0b5e73e86e586',
            '6afe00b520f0b5e73e86e5fe',
            '6afe111137cea1a386b98ff0',
          ];
          const activeSlides = (res.data.heroSlides || [])
            .map((s: any, idx: number) => ({ s, idx }))
            .filter(({ s }: { s: any }) => s && s.active !== false && String(s.image || '').trim().length > 0)
            .filter(({ s }: { s: any }) => !legacyBlacklist.some(k => String(s.image || '').toLowerCase().includes(k)))
            .sort((a: { s: any; idx: number }, b: { s: any; idx: number }) => {
              const orderDiff = (Number(a.s?.sortOrder) || 999) - (Number(b.s?.sortOrder) || 999);
              return orderDiff !== 0 ? orderDiff : a.idx - b.idx;
            })
            .map(({ s }: { s: any }) => s);

          if (activeSlides.length > 0) {
            const mapped: HeroBannerSlide[] = activeSlides.map((s: any, idx: number) => {
              const fallback = this.defaultHeroBanners[idx % this.defaultHeroBanners.length];
              return {
                image: this.resolveMediaUrl(s.image),
                link: s.link || fallback.link || '/online-ordering',
                alt: s.title || s.eyebrow || fallback.alt || `Banner ${idx + 1}`,
                eyebrow: s.eyebrow || fallback.eyebrow || '',
                title: s.title || fallback.title || '',
                subtitle: s.subtitle || fallback.subtitle || '',
                cta: s.cta || fallback.cta || 'Mua sắm ngay',
              };
            });
            const nextSig = mapped.map((b) => `${b.image}|${b.title}|${b.eyebrow}`).join(';;');
            const curSig = this.heroBanners.map((b) => `${b.image}|${b.title}|${b.eyebrow}`).join(';;');
            if (nextSig !== curSig) {
              this.heroBanners = mapped;
              this.activeHero = 0;
            }
          } else {
            this.heroBanners = [...this.defaultHeroBanners];
          }

          if (res.data.promoPopup) {
            this.promoPopup.set(res.data.promoPopup);
            const dismissed = (() => {
              try {
                return Boolean(sessionStorage.getItem('dismiss_promo_popup'));
              } catch {
                return false;
              }
            })();
            if (res.data.promoPopup.enabled && !dismissed && !isRefresh) {
              this.showPromoPopup.set(true);
            } else if (!res.data.promoPopup.enabled) {
              this.showPromoPopup.set(false);
            }
          }
        }
      },
      error: () => { },
    });
  }

  ngOnInit(): void {
    // Nối banner chính động (giữ layout ảnh thuần của main/admin) & Pop-up khuyến mãi từ Admin Banners
    this.loadBanners(false);

    this.voucherService.loadPublic();
    this.voucherService.refreshMine();
    this.productApi.getAll({ limit: 12, sort: 'createdAt' }).subscribe({
      next: res => { this.apiProducts = res.data || []; this.loadingProducts = false; },
      error: () => { this.loadingProducts = false; },
    });
    this.categoryApi.getAll().subscribe({
      next: res => {
        this.categories = res.data || [];
        this.loadingCategories = false;
      },
      error: err => {
        console.error('Failed to load categories from MongoDB:', err);
        this.loadingCategories = false;
      },
    });
    this.flashSaleApi.getActive().subscribe({
      next: res => {
        if (res.success && res.data) {
          this.flashSales = res.data;
          this.syncFlashSaleStock();
        }
        this.loadingFlashSales = false;
      },
      error: err => {
        console.error('Failed to load flash sales:', err);
        this.loadingFlashSales = false;
      },
    });
    this.productApi.getAll({ limit: 500 }).subscribe({
      next: res => {
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
        this.liveProductMap = map;
        this.syncFlashSaleStock();
      },
      error: () => { },
    });
    this.heroTimer = setInterval(() => this.nextHero(), 6500);
    this.countdownTimer = setInterval(() => this.tickCountdown(), 1000);
    this.tickCountdown();
  }
  ngOnDestroy(): void {
    if (this.heroTimer) clearInterval(this.heroTimer);
    if (this.countdownTimer) clearInterval(this.countdownTimer);
    if (this.voucherToastTimer) clearTimeout(this.voucherToastTimer);
  }
  nextHero(): void { this.activeHero = (this.activeHero + 1) % this.heroSlides.length; }
  prevHero(): void { this.activeHero = (this.activeHero - 1 + this.heroSlides.length) % this.heroSlides.length; }
  nextProducts(): void { this.productOffset = Math.min(Math.max(0, this.apiProducts.length - 4), this.productOffset + 1); }
  prevProducts(): void { this.productOffset = Math.max(0, this.productOffset - 1); }
  isVoucherCopied(code: string): boolean {
    return this.voucherService.isCopied(code);
  }
  isVoucherSaved(id: string): boolean {
    return this.voucherService.isSaved(id);
  }
  copyVoucher(code: string): void {
    this.voucherService.copyCode(code);
    this.showVoucherToast(`Đã sao chép mã ${code}. Mã vẫn được giữ hiển thị khi bạn chuyển trang.`);
  }
  saveVoucher(id: string): void {
    if (this.isVoucherSaved(id)) return;
    if (!this.cart.currentUser()) {
      this.pendingVoucherId.set(id);
      this.cart.openAuthModal('login');
      return;
    }
    this.persistVoucher(id);
  }
  private persistVoucher(id: string): void {
    this.voucherService.collectVoucher(id).subscribe((result) => {
      this.showVoucherToast(result.success
        ? 'Đã lưu voucher vào Ví Voucher. Bạn có thể chọn mã tại trang thanh toán.'
        : result.message || 'Không thể lưu voucher lúc này.');
    });
  }
  private voucherDescription(voucher: ApiVoucher): string {
    const discount = voucher.type === 'percentage'
      ? `Giảm ${voucher.value}%`
      : `Giảm ${voucher.value.toLocaleString('vi-VN')}đ`;
    const minimum = voucher.minValue ? ` cho đơn từ ${voucher.minValue.toLocaleString('vi-VN')}đ` : '';
    return `${discount}${minimum}.`;
  }
  productSlug(p: ApiProduct): string { return p.slug?.startsWith('/') ? p.slug : `/product-page/${p.slug}`; }
  isProductUnavailable(p: ApiProduct): boolean {
    if (p.isActive === false) return true;
    if (p.isCombo) {
      if (p.comboStatus === 'paused' || p.comboStatus === 'hidden') return true;
      const comboStock = typeof p.availableStock === 'number' ? p.availableStock : p.stock;
      return typeof comboStock === 'number' && comboStock <= 0;
    }
    return typeof p.stock === 'number' && p.stock <= 0;
  }
  addToCart(p: ApiProduct, event?: Event): void {
    if (this.isProductUnavailable(p)) return;
    if (event) {
      this.cart.animateFlyToCart(event, p.image);
    }
    this.cart.addItem(this.toCartProduct(p), 1);
  }
  getCategoryName(categoryId: string): string {
    return this.categories.find(c => c._id === categoryId)?.name ?? 'Chưa phân loại';
  }
  isDealOutOfStock(deal: FlashSaleItem): boolean {
    return typeof deal.stock === 'number' && deal.stock <= 0;
  }

  private syncFlashSaleStock(): void {
    if (!this.flashSales.length || !this.liveProductMap.size) return;
    this.flashSales = this.flashSales.map((deal) => {
      const cleanSlug = (deal.slug || '').replace(/^\/product-page\//, '').replace(/^\//, '');
      const live = this.liveProductMap.get(String(deal.productId || ''))
        || this.liveProductMap.get(deal.slug || '')
        || this.liveProductMap.get(cleanSlug);
      if (!live) return deal;
      const liveStock = live.isCombo && typeof live.availableStock === 'number'
        ? Math.max(0, Math.floor(live.availableStock))
        : (typeof live.stock === 'number' ? Math.max(0, Math.floor(live.stock)) : deal.stock);
      const isOutOfStock = live.isActive === false || (typeof liveStock === 'number' && liveStock <= 0);
      return {
        ...deal,
        stock: liveStock,
        isSoldOut: Boolean(deal.isSoldOut || isOutOfStock),
      };
    });
  }

  private buildDealCartProduct(deal: FlashSaleItem): XanhLaProduct {
    const priceText = `${(deal.flashSalePrice || 0).toLocaleString('vi-VN')}đ`;
    return {
      id: deal.productId || deal._id,
      name: deal.name,
      slug: deal.slug || deal._id,
      price: priceText,
      priceNumber: deal.flashSalePrice,
      image: deal.image,
      category: 'Vegetables',
      categoryVi: deal.category,
      description: deal.description,
      stock: deal.stock,
    } as XanhLaProduct;
  }

  addDealToCart(deal: FlashSaleItem, event?: Event): void {
    if (deal.isSoldOut || this.isDealOutOfStock(deal)) return;
    if (event) {
      this.cart.animateFlyToCart(event, deal.image);
    }
    this.cart.addItem(this.buildDealCartProduct(deal), 1);
  }

  openBuyNow(product: ApiProduct): void {
    if (this.isProductUnavailable(product)) return;
    this.cart.openBuyNowModal(this.toCartProduct(product));
  }

  openBuyNowDeal(deal: FlashSaleItem): void {
    if (deal.isSoldOut || this.isDealOutOfStock(deal)) return;
    this.cart.openBuyNowModal(this.buildDealCartProduct(deal));
  }

  formatPrice(val: any): string {
    return formatPrice(val);
  }

  onHeroImgError(index: number): void {
    if (this.heroSlides[index]) {
      this.heroSlides[index].image = this.fallbackProductImage;
    }
  }
  private toCartProduct(p: ApiProduct): XanhLaProduct {
    return {
      id: p._id,
      name: p.name,
      slug: p.slug,
      price: formatPrice(p.priceNumber || p.price),
      priceNumber: p.priceNumber,
      image: p.image,
      category: p.categoryId,
      categoryVi: p.categoryVi || '',
      description: p.description,

      container: p.container,
      cutType: p.cutType,
      cutting: p.cutting,
      packSize: p.packSize,
      packaging: p.packaging,
      preparation: p.preparation,
      quantity: p.quantity,
      ripeness: p.ripeness,
      sizeGroup: p.sizeGroup,
      thickness: p.thickness,
      type: p.type,
      weight: p.weight,
      options: p.options,
      stock: typeof p.availableStock === 'number' ? p.availableStock : p.stock,
      availableStock: p.availableStock,
      comboStatus: p.comboStatus,
      isCombo: Boolean(p.isCombo || (Array.isArray(p.comboItems) && p.comboItems.length > 0)),
      originalPriceNumber: p.originalPriceNumber,
      comboItems: p.comboItems,
      addOnDeals: p.addOnDeals as any,
    } as XanhLaProduct;
  }
  private tickCountdown(): void {
    const total = Math.max(0, Math.floor((this.countdownEnd - Date.now()) / 1000));
    this.countdown = {
      hours: String(Math.floor(total / 3600)).padStart(2, '0'),
      minutes: String(Math.floor((total % 3600) / 60)).padStart(2, '0'),
      seconds: String(total % 60).padStart(2, '0'),
    };
  }
}
