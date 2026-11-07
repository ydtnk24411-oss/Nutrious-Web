import { Component, signal, inject, OnInit, ViewChild, ElementRef } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ShellComponent } from '../../components/shell/shell.component';
import { CartService, formatPrice } from '../../shared/services/cart.service';
import { ProductApiService, ApiProduct } from '../../shared/services/product-api.service';
import { ReviewService } from '../../shared/services/review.service';
import { XanhLaProduct } from '../../shared/models/xanh-la.models';

function toCartProduct(p: ApiProduct): XanhLaProduct {
  return {
    id: p._id, name: p.name, slug: p.slug, price: p.price,
    priceNumber: p.priceNumber, image: p.image,
    category: p.categoryId,
categoryVi: '',
description: p.description,
    container: p.container, cutType: p.cutType, cutting: p.cutting,
    packSize: p.packSize, packaging: p.packaging, preparation: p.preparation,
    quantity: p.quantity, ripeness: p.ripeness, sizeGroup: p.sizeGroup,
    thickness: p.thickness, type: p.type, weight: p.weight,
    options: p.options,
    isCombo: p.isCombo,
    originalPriceNumber: p.originalPriceNumber,
    comboItems: p.comboItems,
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

  // Combo mua kèm tiết kiệm
  protected combos          = signal<ApiProduct[]>([]);
  protected addedComboId    = signal<string | null>(null);

  // Review state
  showReviewForm = signal(false);
  reviewRating = signal(0);
  reviewTitle = signal('');
  reviewContent = signal('');
  reviewFilter = signal<'all' | '5' | '4' | '3' | '2' | '1' | 'latest' | 'withImages'>('all');
  submittingReview = signal(false);

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
    this.showReviewForm.set(false);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'instant' });
    }

    // Thử slug trực tiếp, backend hỗ trợ cả dạng slug thuần và /product-page/xxx
    this.productApi.getBySlug(slug).subscribe({
      next: (res) => {
        this.product.set(res.data);
        this.loading.set(false);
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

  comboSaving(combo: ApiProduct): number {
    return Math.max(0, (combo.originalPriceNumber || 0) - (combo.priceNumber || 0));
  }

  comboSavingPercent(combo: ApiProduct): number {
    const original = combo.originalPriceNumber || 0;
    return original > 0 ? Math.round((this.comboSaving(combo) / original) * 100) : 0;
  }

  money(value: number): string {
    return formatPrice(value);
  }

  addCombo(combo: ApiProduct): void {
    this.cart.addItem(toCartProduct(combo), 1);
    this.addedComboId.set(combo._id);
    setTimeout(() => {
      if (this.addedComboId() === combo._id) this.addedComboId.set(null);
    }, 2000);
  }

  itemQty(slug: string): number {
    return this.cart.items().find(i => i.product.slug === slug)?.quantity ?? 0;
  }

  addOne(prod: ApiProduct, event?: Event): void {
    event?.stopPropagation();
    event?.preventDefault();
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

  dec(): void { this.quantity.update(q => Math.max(1, q - 1)); }
  inc(): void { this.quantity.update(q => q + 1); }

  toggleAccordion(k: 'info' | 'refund' | 'shipping'): void {
    this.openAccordions.update(o => ({ ...o, [k]: !o[k] }));
  }

  addToCart(): void {
    const p = this.product();
    if (p) this.cart.addItem(toCartProduct(p), this.quantity(), this.selectedRipeness());
  }

  buyNow(): void {
    const p = this.product();
    if (!p) return;
    const cartProd = toCartProduct(p);
    const ripeness = this.selectedRipeness();
    this.cart.addItem(cartProd, this.quantity(), ripeness);
    this.cart.selectOnly(cartProd.slug, ripeness);
    this.cart.closeCartDrawer();
    this.router.navigate(['/checkout']);
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
    }).subscribe({
      next: () => {
        this.submittingReview.set(false);
        this.showReviewForm.set(false);
        this.reviewRating.set(0);
        this.reviewTitle.set('');
        this.reviewContent.set('');
      },
      error: (err) => {
        this.submittingReview.set(false);
        alert(err?.error?.message || 'Không gửi được đánh giá, vui lòng thử lại.');
      },
    });
  }

  markHelpful(reviewId: string): void {
    const p = this.product();
    if (!p) return;
    if (!this.cart.currentUser()) {
      this.cart.openAuthModal('login');
      return;
    }
    this.reviewService.markHelpful(reviewId, p._id).subscribe({ error: () => { /* bỏ qua */ } });
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
