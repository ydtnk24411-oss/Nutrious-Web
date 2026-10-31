import { Component, signal, inject, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ShellComponent } from '../../components/shell/shell.component';
import { CartService } from '../../shared/services/cart.service';
import { ProductApiService, ApiProduct } from '../../shared/services/product-api.service';
import { XanhLaProduct } from '../../shared/models/xanh-la.models';

function toCartProduct(p: ApiProduct): XanhLaProduct {
  return {
    id: p._id, name: p.name, slug: p.slug, price: p.price,
    priceNumber: p.priceNumber, image: p.image,
    category: p.category as 'Vegetables' | 'Fruits' | 'Meat',
    categoryVi: p.categoryVi, description: p.description,
    container: p.container, cutType: p.cutType, cutting: p.cutting,
    packSize: p.packSize, packaging: p.packaging, preparation: p.preparation,
    quantity: p.quantity, ripeness: p.ripeness, sizeGroup: p.sizeGroup,
    thickness: p.thickness, type: p.type, weight: p.weight,
    options: p.options,
  };
}

export const ORDERING_CATEGORIES = [
  'Rau củ & trái cây',
  'Thịt & hải sản',
  'Sữa & thực phẩm mát',
  'Thức uống',
  'Bánh & đồ ăn vặt',
  'Gia vị & thực phẩm khô',
  'Chăm sóc cá nhân',
  'Nhà cửa & đời sống',
];

export function toMainCategory(p: ApiProduct): string {
  const cat = (p.category || '').toLowerCase();
  const catVi = (p.categoryVi || '').toLowerCase();
  if (cat === 'vegetables' || cat === 'fruits' || catVi.includes('rau') || catVi.includes('củ') || catVi.includes('nấm') || catVi.includes('đặc sản') || catVi.includes('trái cây')) {
    return 'Rau củ & trái cây';
  }
  if (cat === 'meat' || cat === 'seafood' || catVi.includes('thịt') || catVi.includes('heo') || catVi.includes('bò') || catVi.includes('gà') || catVi.includes('vịt') || catVi.includes('tôm') || catVi.includes('cá') || catVi.includes('mực') || catVi.includes('cua') || catVi.includes('nhuyễn thể')) {
    return 'Thịt & hải sản';
  }
  if (cat === 'dairy' || catVi.includes('sữa') || catVi.includes('trứng') || catVi.includes('phô mai') || catVi.includes('bơ')) {
    return 'Sữa & thực phẩm mát';
  }
  if (cat === 'beverages' || catVi.includes('uống') || catVi.includes('trà') || catVi.includes('cà phê') || catVi.includes('khoáng') || catVi.includes('bia')) {
    return 'Thức uống';
  }
  if (cat === 'bakery' || catVi.includes('bánh') || catVi.includes('snack') || catVi.includes('kẹo')) {
    return 'Bánh & đồ ăn vặt';
  }
  if (cat === 'pantry' || catVi.includes('gia vị') || catVi.includes('dầu ăn') || catVi.includes('gạo') || catVi.includes('mì')) {
    return 'Gia vị & thực phẩm khô';
  }
  if (cat === 'personal' || catVi.includes('tắm') || catVi.includes('gội') || catVi.includes('răng') || catVi.includes('khăn') || catVi.includes('dưỡng da') || catVi.includes('cá nhân')) {
    return 'Chăm sóc cá nhân';
  }
  if (cat === 'household' || catVi.includes('tẩy rửa') || catVi.includes('giặt') || catVi.includes('bảo quản') || catVi.includes('nhà') || catVi.includes('đời sống')) {
    return 'Nhà cửa & đời sống';
  }
  return 'Rau củ & trái cây';
}

export function normalizeCategoryTarget(cat: string): string {
  const c = cat.toLowerCase().trim();
  if (c.includes('rau') || c.includes('trái cây') || c.includes('vegetable') || c.includes('fruit')) return 'Rau củ & trái cây';
  if (c.includes('thịt') || c.includes('hải sản') || c.includes('cá') || c.includes('meat') || c.includes('seafood')) return 'Thịt & hải sản';
  if (c.includes('sữa') || c.includes('mát') || c.includes('trứng') || c.includes('dairy')) return 'Sữa & thực phẩm mát';
  if (c.includes('thức uống') || c.includes('đồ uống') || c.includes('uống') || c.includes('beverage')) return 'Thức uống';
  if (c.includes('bánh') || c.includes('vặt') || c.includes('snack') || c.includes('bakery')) return 'Bánh & đồ ăn vặt';
  if (c.includes('gia vị') || c.includes('thảo mộc') || c.includes('khô') || c.includes('pantry')) return 'Gia vị & thực phẩm khô';
  if (c.includes('cá nhân') || c.includes('personal')) return 'Chăm sóc cá nhân';
  if (c.includes('nhà cửa') || c.includes('đời sống') || c.includes('household')) return 'Nhà cửa & đời sống';
  return cat;
}

@Component({
  selector: 'app-ordering',
  standalone: true,
  imports: [CommonModule, ShellComponent, RouterLink],
  templateUrl: './ordering.component.html',
  styleUrl: './ordering.component.css',
})
export class OrderingComponent implements OnInit {
  protected cart       = inject(CartService);
  private productApi   = inject(ProductApiService);
  private router       = inject(Router);
  private route        = inject(ActivatedRoute);

  protected fulfillment   = signal<'pickup' | 'delivery'>('pickup');
  protected activeSection = signal('');
  protected loading       = signal(true);
  protected error         = signal('');
  protected allProducts   = signal<ApiProduct[]>([]);

  // ── Filter state ──────────────────────────────────────
  protected search    = signal('');
  protected maxPrice  = signal(300);
  protected sortBy    = signal('default');

  protected selectedFilters = signal<Record<string, string[]>>({
    category: [], preparation: [], ripeness: [], sizeGroup: [], type: [], weight: [],
  });

  // ── Filter accordion open state ───────────────────────
  protected openAccordions = signal<Record<string, boolean>>({
    price: true, category: true, preparation: false,
    ripeness: false, sizeGroup: false, type: false, weight: false,
  });

  // ── Computed facet options từ data thực tế ─────────────
  protected facetOptions = computed(() => {
    const all = this.allProducts();
    const unique = (arr: string[]) => [...new Set(arr.filter(Boolean))].sort();
    return {
      category:    ORDERING_CATEGORIES.filter(c => all.some(p => toMainCategory(p) === c)),
      preparation: unique(all.map(p => p.preparation)),
      ripeness:    unique(all.map(p => p.ripeness)),
      sizeGroup:   unique(all.map(p => p.sizeGroup)),
      type:        unique(all.map(p => p.type)),
      weight:      unique(all.map(p => p.weight)),
    };
  });

  protected maxPriceInDB = computed(() =>
    Math.ceil(Math.max(...this.allProducts().map(p => p.priceNumber), 300) / 50) * 50
  );

  protected hasActiveFilters = computed(() => {
    const f = this.selectedFilters();
    return Object.values(f).some(a => a.length > 0)
      || this.maxPrice() < this.maxPriceInDB()
      || !!this.search();
  });

  // ── Filtered + sorted products ────────────────────────
  protected filteredProducts = computed(() => {
    const f    = this.selectedFilters();
    const q    = this.search().toLowerCase().trim();
    const maxP = this.maxPrice();
    let list   = this.allProducts().filter(p => {
      if (q && !p.name.toLowerCase().includes(q) && !p.description.toLowerCase().includes(q)) return false;
      if (p.priceNumber > maxP) return false;
      if (f['category'].length && !f['category'].includes(toMainCategory(p))) return false;
      if (f['preparation'].length && !f['preparation'].includes(p.preparation)) return false;
      if (f['ripeness'].length   && !f['ripeness'].includes(p.ripeness))        return false;
      if (f['sizeGroup'].length  && !f['sizeGroup'].includes(p.sizeGroup))      return false;
      if (f['type'].length       && !f['type'].includes(p.type))                return false;
      if (f['weight'].length     && !f['weight'].includes(p.weight))            return false;
      return true;
    });
    if (this.sortBy() === 'price-asc')  list = [...list].sort((a, b) => a.priceNumber - b.priceNumber);
    if (this.sortBy() === 'price-desc') list = [...list].sort((a, b) => b.priceNumber - a.priceNumber);
    if (this.sortBy() === 'name-asc')   list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    return list;
  });

  // ── Group filtered products into sections ─────────────
  protected sections = computed(() => {
    const groups: Record<string, ApiProduct[]> = {};
    for (const cat of ORDERING_CATEGORIES) {
      groups[cat] = [];
    }
    for (const p of this.filteredProducts()) {
      const key = toMainCategory(p);
      if (!groups[key]) groups[key] = [];
      groups[key].push(p);
    }
    return ORDERING_CATEGORIES
      .filter(title => groups[title] && groups[title].length > 0)
      .map(title => ({ title, items: groups[title] }));
  });

  ngOnInit(): void {
    const q = this.route.snapshot.queryParamMap.get('q');
    if (q) this.search.set(q);

    this.productApi.getAll({ limit: 100, sort: 'createdAt' }).subscribe({
      next: (res) => {
        this.allProducts.set(res.data);
        if (res.data.length > 0) {
          const firstSec = this.sections()[0]?.title || 'Rau củ & trái cây';
          this.activeSection.set(firstSec);
          this.maxPrice.set(this.maxPriceInDB());
        }
        this.loading.set(false);

        const cat = this.route.snapshot.queryParamMap.get('category');
        if (cat) {
          const target = normalizeCategoryTarget(cat);
          this.activeSection.set(target);
          setTimeout(() => this.scrollTo(target), 200);
        }
      },
      error: () => { this.error.set('Không thể tải sản phẩm.'); this.loading.set(false); },
    });

    this.route.queryParamMap.subscribe(params => {
      const cat = params.get('category');
      if (cat && !this.loading()) {
        const target = normalizeCategoryTarget(cat);
        this.activeSection.set(target);
        setTimeout(() => this.scrollTo(target), 100);
      }
    });
  }

  scrollTo(title: string): void {
    this.activeSection.set(title);
    const el = document.getElementById('section-' + title);
    if (el) {
      const yOffset = -90;
      const y = el.getBoundingClientRect().top + window.pageYOffset + yOffset;
      window.scrollTo({ top: y, behavior: 'smooth' });
    }
  }

  toggleAccordion(key: string): void {
    this.openAccordions.update(o => ({ ...o, [key]: !o[key] }));
  }

  toggleFilter(facet: string, val: string): void {
    this.selectedFilters.update(f => {
      const arr = f[facet] ?? [];
      return { ...f, [facet]: arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val] };
    });
  }

  isChecked(facet: string, val: string): boolean {
    return (this.selectedFilters()[facet] ?? []).includes(val);
  }

  clearAllFilters(): void {
    this.selectedFilters.set({ category: [], preparation: [], ripeness: [], sizeGroup: [], type: [], weight: [] });
    this.search.set('');
    this.maxPrice.set(this.maxPriceInDB());
    this.sortBy.set('default');
  }

  itemQty(slug: string): number {
    return this.cart.items().find(i => i.product.slug === slug)?.quantity ?? 0;
  }

  addOne(prod: ApiProduct): void    { this.cart.addItem(toCartProduct(prod), 1); }

  removeOne(prod: ApiProduct): void {
    const qty = this.itemQty(prod.slug);
    if (qty > 1) this.cart.updateQuantity(prod.slug, qty - 1);
    else         this.cart.removeItem(prod.slug);
  }

  goToCart(): void { this.router.navigate(['/checkout']); }
}
