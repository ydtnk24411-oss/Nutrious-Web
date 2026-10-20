import { CommonModule } from '@angular/common';
import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { ShellComponent } from '../../components/shell/shell.component';
import { CartService } from '../../shared/services/cart.service';
import { ProductApiService, ApiProduct } from '../../shared/services/product-api.service';
import { CategoryApiService } from '../../shared/services/category-api.service';
import { heroImage, originImage } from '../../shared/data/xanh-la.data';
import { XanhLaProduct } from '../../shared/models/xanh-la.models';

interface Deal {
  id: string; name: string; category: string; description: string; image: string;
  priceNew: string; priceOld: string; discountPct: number; save: string;
}
interface Voucher {
  code: string; title: string; value: string; valueShort: string; expiry: string;
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
    { name: 'Rau củ, trái cây', icon: '🥬' }, { name: 'Thịt, trứng, cá', icon: '🥩' },
    { name: 'Thực phẩm mát', icon: '🥛' }, { name: 'Thức uống', icon: '🥤' },
    { name: 'Bánh & đồ ăn vặt', icon: '🍪' }, { name: 'Gia vị, thực phẩm khô', icon: '🧂' },
    { name: 'Chăm sóc cá nhân', icon: '🧴' }, { name: 'Nhà cửa & đời sống', icon: '🧺' },
  ];
  readonly visualCategories = [
    { name: 'Rau củ & trái cây', icon: '🥦', image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=700&q=85' },
    { name: 'Thịt & hải sản', icon: '🐟', image: 'https://images.unsplash.com/photo-1607623814075-e51df1bdc82f?auto=format&fit=crop&w=700&q=85' },
    { name: 'Sữa & thực phẩm mát', icon: '🥛', image: 'https://images.unsplash.com/photo-1563636619-e9143da7973b?auto=format&fit=crop&w=700&q=85' },
    { name: 'Thức uống', icon: '🥤', image: 'https://images.unsplash.com/photo-1544145945-f90425340c7e?auto=format&fit=crop&w=700&q=85' },
    { name: 'Bánh & đồ ăn vặt', icon: '🍪', image: 'https://images.unsplash.com/photo-1499636136210-6f4ee915583e?auto=format&fit=crop&w=700&q=85' },
    { name: 'Gia vị & thực phẩm khô', icon: '🌾', image: 'https://images.unsplash.com/photo-1532336414038-cf19250c5757?auto=format&fit=crop&w=700&q=85' },
    { name: 'Chăm sóc cá nhân', icon: '🧴', image: 'https://images.unsplash.com/photo-1608248543803-ba4f8c70ae0b?auto=format&fit=crop&w=700&q=85' },
    { name: 'Nhà cửa & đời sống', icon: '🧺', image: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=700&q=85' },
  ];
  readonly vouchers: Voucher[] = [
    { code: 'XANHLA30', title: 'Chào bạn mới', value: 'Tặng mã 30K cho khách hàng mới', valueShort: '30K', expiry: 'HSD: 10 ngày từ ngày nhận mã', color: 'green' },
    { code: 'XANHLA20', title: 'Ưu đãi đi chợ online', value: 'Giảm 20K cho đơn hàng phù hợp', valueShort: '20K', expiry: 'Ưu đãi có thời hạn', color: 'amber' },
    { code: 'COMBO30', title: 'Combo bữa nhà', value: 'Giảm 30K khi mua combo nguyên liệu', valueShort: '30K', expiry: 'Số lượng ưu đãi có hạn', color: 'red' },
  ];
  copiedCode = '';
  readonly deals: Deal[] = [
    { id: 'deal-1', name: 'Rau cải xanh tươi', category: 'Rau củ', description: 'Gợi ý cho món canh, món xào trong bữa cơm nhà.', image: 'https://images.unsplash.com/photo-1576045057995-568f588f82fb?auto=format&fit=crop&w=700&q=85', priceNew: '18.000đ', priceOld: '30.000đ', discountPct: 40, save: '12.000đ' },
    { id: 'deal-2', name: 'Cà chua bi đỏ', category: 'Rau củ & trái cây', description: 'Thêm sắc đỏ tươi ngon cho salad và món ăn mỗi ngày.', image: 'https://images.unsplash.com/photo-1546094096-0df4bcaaa337?auto=format&fit=crop&w=700&q=85', priceNew: '22.000đ', priceOld: '38.000đ', discountPct: 42, save: '16.000đ' },
    { id: 'deal-3', name: 'Gừng tươi nguyên củ', category: 'Gia vị', description: 'Gia vị quen thuộc giúp món ăn thêm đậm đà.', image: 'https://images.unsplash.com/photo-1615485500834-bc10199bc727?auto=format&fit=crop&w=700&q=85', priceNew: '12.000đ', priceOld: '20.000đ', discountPct: 40, save: '8.000đ' },
    { id: 'deal-4', name: 'Trái cây theo mùa', category: 'Trái cây', description: 'Lựa chọn nhiều màu sắc cho món tráng miệng.', image: 'https://images.unsplash.com/photo-1610832958506-aa56368176cf?auto=format&fit=crop&w=700&q=85', priceNew: '39.000đ', priceOld: '55.000đ', discountPct: 29, save: '16.000đ' },
  ];
  readonly newsItems: NewsItem[] = [
    { title: 'Mẹo chọn rau củ tươi ngon cho cả tuần', image: 'https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=900&q=85', path: '/event-list', date: 'CẨM NANG MUA SẮM' },
    { title: 'Gợi ý thực đơn nhanh gọn cho ngày bận rộn', image: 'https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=900&q=85', path: '/nutrition', date: 'CẢM HỨNG GIAN BẾP' },
    { title: 'Sắp xếp căn bếp gọn gàng, dễ tìm nguyên liệu', image: 'https://images.unsplash.com/photo-1556911220-e15b29be8c8f?auto=format&fit=crop&w=900&q=85', path: '/event-list', date: 'SỐNG TIỆN NGHI' },
  ];

  apiProducts: ApiProduct[] = [];
  loadingProducts = true;
  productOffset = 0;
  countdown = { hours: '05', minutes: '42', seconds: '18' };
  private countdownEnd = Date.now() + 5 * 60 * 60 * 1000 + 42 * 60 * 1000 + 18000;
  private countdownTimer: ReturnType<typeof setInterval> | null = null;

  get visibleProducts(): ApiProduct[] { return this.apiProducts.slice(this.productOffset, this.productOffset + 4); }

  ngOnInit(): void {
    this.productApi.getAll({ limit: 12, sort: 'createdAt' }).subscribe({
      next: res => { this.apiProducts = res.data || []; this.loadingProducts = false; },
      error: () => { this.loadingProducts = false; },
    });
    this.categoryApi.getAll().subscribe({ error: () => undefined });
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
  copyVoucher(code: string): void {
    if (typeof navigator !== 'undefined' && navigator.clipboard) navigator.clipboard.writeText(code).catch(() => undefined);
    this.copiedCode = code;
    setTimeout(() => { if (this.copiedCode === code) this.copiedCode = ''; }, 1800);
  }
  productSlug(p: ApiProduct): string { return p.slug?.startsWith('/') ? p.slug : `/product-page/${p.slug}`; }
  addToCart(p: ApiProduct): void { this.cart.addItem(this.toCartProduct(p), 1); }
  addDealToCart(deal: Deal): void {
    const product = {
      id: deal.id, name: deal.name, slug: deal.id, price: deal.priceNew,
      priceNumber: Number(deal.priceNew.replace(/\D/g, '')), image: deal.image,
      category: 'Vegetables', categoryVi: deal.category, description: deal.description,
    } as XanhLaProduct;
    this.cart.addItem(product, 1);
  }
  private toCartProduct(p: ApiProduct): XanhLaProduct {
    return {
      id: p._id, name: p.name, slug: p.slug, price: p.price, priceNumber: p.priceNumber,
      image: p.image, category: p.category as 'Vegetables' | 'Fruits' | 'Meat',
      categoryVi: p.categoryVi, description: p.description, container: p.container,
      cutType: p.cutType, cutting: p.cutting, packSize: p.packSize, packaging: p.packaging,
      preparation: p.preparation, quantity: p.quantity, ripeness: p.ripeness, sizeGroup: p.sizeGroup,
      thickness: p.thickness, type: p.type, weight: p.weight, options: p.options,
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
