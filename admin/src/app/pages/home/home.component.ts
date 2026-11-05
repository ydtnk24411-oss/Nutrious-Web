import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, computed, effect, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ShellComponent } from '../../components/shell/shell.component';
import { CartService } from '../../shared/services/cart.service';
import { ProductApiService, ApiProduct } from '../../shared/services/product-api.service';
import { heroImage, originImage } from '../../shared/data/xanh-la.data';
import { Voucher as ApiVoucher, XanhLaProduct } from '../../shared/models/xanh-la.models';
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

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, ShellComponent, RouterLink],
  templateUrl: './home.component.html',
  styleUrl: './home.component.css',
})
export class HomeComponent implements OnInit, OnDestroy {
  private cart = inject(CartService);
  private productApi = inject(ProductApiService);
  private categoryApi = inject(CategoryApiService);
  private voucherService = inject(VoucherService);
  private flashSaleApi = inject(FlashSaleApiService);

  readonly heroImage = heroImage;
  readonly originImage = originImage;
  readonly fallbackProductImage = 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=700&q=80';

  readonly heroSlides = [
    { eyebrow: 'TƯƠI NGON MỖI NGÀY', title: 'Đi chợ thông minh, chăm nhà thật vui.', subtitle: 'Thực phẩm tươi, sản phẩm thiết yếu và ưu đãi dành cho cả gia đình.', cta: 'Mua sắm ngay', image: 'https://images.unsplash.com/photo-1542838132-92c53300491e?auto=format&fit=crop&w=1600&q=90' },
    { eyebrow: 'BỮA CƠM NHÀ THÊM ĐỦ ĐẦY', title: 'Chọn điều tươi lành mỗi ngày.', subtitle: 'Khám phá rau củ, trái cây và nguyên liệu cho những bữa ăn ngon.', cta: 'Khám phá gian hàng', image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=1600&q=90' },
    { eyebrow: 'SĂN DEAL – NHẬN ƯU ĐÃI', title: 'Mua sắm tiết kiệm, vui trọn mỗi ngày.', subtitle: 'Đừng bỏ lỡ những sản phẩm nổi bật và mã ưu đãi dành riêng cho bạn.', cta: 'Xem ưu đãi', image: 'https://images.unsplash.com/photo-1543083477-4f785aeafaa9?auto=format&fit=crop&w=1600&q=90' },
  ];
  activeHero = 0;
  private heroTimer: ReturnType<typeof setInterval> | null = null;

  readonly quickCategories = [
    { name: 'Rau củ', icon: '🥬' },
    { name: 'Trái cây', icon: '🍎' },
    { name: 'Thịt', icon: '🥩' },
    { name: 'Cá & Hải sản', icon: '🐟' },
    { name: 'Sữa & Thực phẩm mát', icon: '🥛' },
    { name: 'Thức uống', icon: '🥤' },
    { name: 'Bánh & Đồ ăn vặt', icon: '🍪' },
    { name: 'Gia vị & Thực phẩm khô', icon: '🧂' },
  ];
  readonly visualCategories = [
    { name: 'Rau củ', icon: '🥬', image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=700&q=85' },
    { name: 'Trái cây', icon: '🍎', image: 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=700&q=85' },
    { name: 'Thịt', icon: '🥩', image: 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?auto=format&fit=crop&w=700&q=85' },
    { name: 'Cá & Hải sản', icon: '🐟', image: 'https://images.unsplash.com/photo-1615141982883-c7ad0e69fd62?auto=format&fit=crop&w=700&q=85' },
    { name: 'Sữa & Thực phẩm mát', icon: '🥛', image: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?auto=format&fit=crop&w=700&q=85' },
    { name: 'Thức uống', icon: '🥤', image: 'https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=700&q=85' },
    { name: 'Bánh & Đồ ăn vặt', icon: '🍪', image: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&w=700&q=85' },
    { name: 'Gia vị & Thực phẩm khô', icon: '🧂', image: 'https://images.unsplash.com/photo-1532336414038-cf19250c5757?auto=format&fit=crop&w=700&q=85' },
  ];
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
  private pendingVoucherId = signal<string | null>(null);

  flashSales: FlashSaleItem[] = [];
  loadingFlashSales = true;
  readonly newsItems: NewsItem[] = [
    { title: 'Mẹo chọn rau củ tươi ngon cho cả tuần', image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=900&q=85', path: '/cam-nang/meo-chon-rau-cu-tuoi-ngon', date: 'CẨM NANG MUA SẮM' },
    { title: 'Gợi ý thực đơn nhanh gọn cho ngày bận rộn', image: 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=85', path: '/cam-nang/thuc-don-nhanh-gon-ngay-ban-ron', date: 'CẢM HỨNG GIAN BẾP' },
    { title: 'Sắp xếp căn bếp gọn gàng, dễ tìm nguyên liệu', image: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=900&q=85', path: '/cam-nang/sap-xep-can-bep-gon-gang', date: 'SỐNG TIỆN NGHI' },
  ];

  apiProducts: ApiProduct[] = [];
  categories: ApiCategory[] = [];
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

  ngOnInit(): void {
    this.voucherService.loadPublic();
    this.voucherService.refreshMine();
    this.productApi.getAll({ limit: 12, sort: 'createdAt' }).subscribe({
      next: res => { this.apiProducts = res.data || []; this.loadingProducts = false; },
      error: () => { this.loadingProducts = false; },
    });
    this.categoryApi.getAll().subscribe({
      next: res => {
        this.categories = res.data || [];
      },
      error: err => {
        console.error('Failed to load categories:', err);
      },
    });
    this.flashSaleApi.getActive().subscribe({
      next: res => {
        if (res.success && res.data) {
          this.flashSales = res.data;
        }
        this.loadingFlashSales = false;
      },
      error: err => {
        console.error('Failed to load flash sales:', err);
        this.loadingFlashSales = false;
      },
    });
    this.heroTimer = setInterval(() => this.nextHero(), 6500);
    this.countdownTimer = setInterval(() => this.tickCountdown(), 1000);
    this.tickCountdown();
  }
  ngOnDestroy(): void {
    if (this.heroTimer) clearInterval(this.heroTimer);
    if (this.countdownTimer) clearInterval(this.countdownTimer);
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
    this.voucherToast.set(`Đã sao chép mã ${code}. Mã vẫn được giữ hiển thị khi bạn chuyển trang.`);
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
      this.voucherToast.set(result.success
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
  addToCart(p: ApiProduct): void { this.cart.addItem(this.toCartProduct(p), 1); }
  getCategoryName(categoryId: string): string {
    return this.categories.find(c => c._id === categoryId)?.name ?? 'Chưa phân loại';
  }
  addDealToCart(deal: FlashSaleItem): void {
    if (deal.isSoldOut) return;
    const priceText = (deal.flashSalePrice || 0).toLocaleString('vi-VN') + 'đ';
    const product = {
      id: deal.productId || deal._id,
      name: deal.name,
      slug: deal.slug || deal._id,
      price: priceText,
      priceNumber: deal.flashSalePrice,
      image: deal.image,
      category: 'Vegetables',
      categoryVi: deal.category,
      description: deal.description,
    } as XanhLaProduct;
    this.cart.addItem(product, 1);
  }

  formatPrice(val: number): string {
    return (val || 0).toLocaleString('vi-VN') + 'đ';
  }
  private toCartProduct(p: ApiProduct): XanhLaProduct {
    return {
      id: p._id,
      name: p.name,
      slug: p.slug,
      price: p.price,
      priceNumber: p.priceNumber,
      image: p.image,
      category: p.categoryId,
      categoryVi: '',
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
