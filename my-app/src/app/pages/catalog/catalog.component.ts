import { Component, signal, computed, inject, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ShellComponent } from '../../components/shell/shell.component';
import { CartService } from '../../shared/services/cart.service';
import { ProductApiService, ApiProduct } from '../../shared/services/product-api.service';
import { FILTER_FACETS } from '../../shared/data/xanh-la.data';
import { XanhLaProduct } from '../../shared/models/xanh-la.models';

type FacetKey = keyof typeof FILTER_FACETS;

// Map ApiProduct → XanhLaProduct để CartService dùng
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

@Component({
  selector: 'app-catalog',
  standalone: true,
  imports: [CommonModule, ShellComponent, RouterLink],
  templateUrl: './catalog.component.html',
  styleUrl: './catalog.component.css',
})
export class CatalogComponent implements OnInit {
  protected cart       = inject(CartService);
  private route        = inject(ActivatedRoute);
  private productApi   = inject(ProductApiService);

  protected readonly facets    = FILTER_FACETS;
  protected readonly facetKeys = Object.keys(FILTER_FACETS) as FacetKey[];

  // Products từ API
  protected products = signal<ApiProduct[]>([]);
  protected total    = signal(0);
  protected loading  = signal(true);
  protected error    = signal('');

  // Filters / sort / pagination
  protected category  = signal<string | null>(null);
  protected sortBy    = signal('createdAt');
  protected maxPrice  = signal(300);
  protected page      = signal(1);
  protected readonly limit = 20;

  protected selectedFilters = signal<Record<string, string[]>>({
    categories: [], container: [], cutType: [], cutting: [],
    packSize: [], packaging: [], preparation: [], quantity: [],
    ripeness: [], sizeGroup: [], thickness: [], type: [], weight: [],
  });

  protected openAccordions = signal<Record<string, boolean>>({
    categories: true, price: true, container: false, cutType: false,
    cutting: false, packSize: false, packaging: false, preparation: false,
    quantity: false, ripeness: false, sizeGroup: false, thickness: false,
    type: false, weight: false,
  });

  protected totalPages = computed(() => Math.ceil(this.total() / this.limit));

  protected hasActiveFilters = computed(() => {
    const f = this.selectedFilters();
    return Object.values(f).some(a => a.length > 0) || this.maxPrice() < 300;
  });

  ngOnInit(): void {
    const slug = this.route.snapshot.paramMap.get('slug');
    if (slug && slug !== 'all-products') {
      this.category.set(slug);
    }
    this.load();
  }

  load(): void {
    this.loading.set(true);
    const params: Record<string, string | number> = {
      page: this.page(), limit: this.limit, sort: this.sortBy(),
    };
    if (this.category()) params['category'] = this.category()!;

    this.productApi.getAll(params).subscribe({
      next: (res) => {
        this.products.set(res.data);
        this.total.set(res.total);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Không thể tải sản phẩm. Kiểm tra backend đang chạy.');
        this.loading.set(false);
      },
    });
  }

  // ----- Filter helpers (client-side vì đã load toàn bộ page) -----
  protected filteredProducts = computed(() => {
    const f = this.selectedFilters();
    let list = this.products().filter(p => {
      if (f['categories'].length && !f['categories'].includes(p.category)) return false;
      if (p.priceNumber > this.maxPrice()) return false;
      if (f['container'].length   && !f['container'].includes(p.container))   return false;
      if (f['cutType'].length     && !f['cutType'].includes(p.cutType))       return false;
      if (f['cutting'].length     && !f['cutting'].includes(p.cutting))       return false;
      if (f['packSize'].length    && !f['packSize'].includes(p.packSize))     return false;
      if (f['packaging'].length   && !f['packaging'].includes(p.packaging))   return false;
      if (f['preparation'].length && !f['preparation'].includes(p.preparation)) return false;
      if (f['quantity'].length    && !f['quantity'].includes(p.quantity))     return false;
      if (f['ripeness'].length    && !f['ripeness'].includes(p.ripeness))     return false;
      if (f['sizeGroup'].length   && !f['sizeGroup'].includes(p.sizeGroup))   return false;
      if (f['thickness'].length   && !f['thickness'].includes(p.thickness))   return false;
      if (f['type'].length        && !f['type'].includes(p.type))             return false;
      if (f['weight'].length      && !f['weight'].includes(p.weight))         return false;
      return true;
    });
    const s = this.sortBy();
    if (s === 'price-asc')  list = [...list].sort((a, b) => a.priceNumber - b.priceNumber);
    if (s === 'price-desc') list = [...list].sort((a, b) => b.priceNumber - a.priceNumber);
    if (s === 'name-asc')   list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    if (s === 'name-desc')  list = [...list].sort((a, b) => b.name.localeCompare(a.name));
    return list;
  });

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

  clearAll(): void {
    this.selectedFilters.set({
      categories: [], container: [], cutType: [], cutting: [],
      packSize: [], packaging: [], preparation: [], quantity: [],
      ripeness: [], sizeGroup: [], thickness: [], type: [], weight: [],
    });
    this.maxPrice.set(300);
    this.category.set(null);
    this.load();
  }

  onSort(val: string): void { this.sortBy.set(val); this.page.set(1); this.load(); }
  prevPage(): void { if (this.page() > 1)                { this.page.update(p => p - 1); this.load(); } }
  nextPage(): void { if (this.page() < this.totalPages()) { this.page.update(p => p + 1); this.load(); } }

  addToCart(prod: ApiProduct): void {
    this.cart.addItem(toCartProduct(prod), 1);
  }

  facetLabel(key: string): string {
    const labels: Record<string, string> = {
      categories: 'Loại sản phẩm', container: 'Container', cutType: 'Cut Type',
      cutting: 'Cutting', packSize: 'Pack Size', packaging: 'Packaging',
      preparation: 'Preparation', quantity: 'Quantity', ripeness: 'Ripeness',
      sizeGroup: 'Size Group', thickness: 'Thickness', type: 'Type', weight: 'Weight',
    };
    return labels[key] ?? key;
  }

  productSlug(p: ApiProduct): string {
    // slug trong DB có dạng /product-page/xxx hoặc xxx
    return p.slug.startsWith('/') ? p.slug : `/product-page/${p.slug}`;
  }
}
