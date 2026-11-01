
import { Component, signal, inject, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ShellComponent } from '../../components/shell/shell.component';
import { CartService } from '../../shared/services/cart.service';
import {
  ProductApiService,
  ApiProduct
} from '../../shared/services/product-api.service';
import { XanhLaProduct } from '../../shared/models/xanh-la.models';
import {
  CategoryApiService,
  ApiCategory
} from '../../shared/services/category-api.service';

function toCartProduct(p: ApiProduct): XanhLaProduct {
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
  };
}

export function toMainCategory(p: ApiProduct): string {
  return p.categoryId;
}

export function normalizeCategoryTarget(cat: string): string {
  return cat.trim();
}

export interface FacetOption {
  value: string;
  label: string;
  count: number;
}

export const FACET_LABEL_MAP: Record<string, Record<string, string>> = {
  preparation: {
    'Brewing Required': 'Cần pha / Hãm trà',
    'Cleaned Raw': 'Sơ chế sạch',
    'Cooked': 'Đã chế biến chín',
    'Cooked Frozen': 'Chín đông lạnh',
    'Instant Mix': 'Hòa tan / Dùng liền',
    'Raw': 'Tươi sống (chưa chế biến)',
    'Ready to Coat': 'Bột tẩm chiên',
    'Ready to Cook': 'Sơ chế nấu ngay',
    'Ready to Drink': 'Uống liền',
    'Ready to Eat': 'Ăn liền / Dùng ngay',
    'Ready to Use': 'Dùng trực tiếp',
    'Requires Bake': 'Cần nướng',
    'Requires Boiling': 'Cần luộc / nấu sôi',
    'Requires Mix': 'Cần pha trộn',
    'Requires Soaking': 'Cần ngâm nước',
  },
  ripeness: {
    'Dried': 'Đồ khô / Sấy khô',
    'Fresh': 'Tươi mới',
    'Fresh Frozen': 'Cấp đông tươi',
    'Frozen': 'Đông lạnh',
    'Ready to Cook': 'Sơ chế nấu ngay',
    'Ready to Eat': 'Ăn liền / Dùng ngay',
    'Ripe': 'Chín mọng / Chín tới',
    'Shelf Stable': 'Bảo quản nhiệt độ phòng',
  },
  sizeGroup: {
    'Extra Large': 'Cực lớn (XL)',
    'Large': 'Lớn (L)',
    'Medium': 'Vừa (M)',
    'Small': 'Nhỏ (S)',
  },
  type: {
    'Bakery': 'Bánh quy & bánh ngọt',
    'Beverage': 'Nước giải khát',
    'Cereal Drink': 'Thức uống ngũ cốc',
    'Chilled': 'Bảo quản mát (Sữa & bơ)',
    'Coffee': 'Cà phê',
    'Confectionery': 'Bánh kẹo & socola',
    'Dried Fruit': 'Trái cây sấy',
    'Dry': 'Hàng khô & gia vị',
    'Energy': 'Nước tăng lực',
    'Fresh': 'Hàng tươi sống',
    'Fresh Bakery': 'Bánh tươi & bánh mì',
    'Frozen': 'Đông lạnh',
    'Herbal': 'Trà thảo mộc & thanh nhiệt',
    'Juice': 'Nước ép trái cây',
    'Live': 'Hải sản tươi sống (đang bơi)',
    'Natural': 'Tự nhiên',
    'Nutritional': 'Bổ dưỡng & dinh dưỡng',
    'Nuts': 'Hạt dinh dưỡng',
    'Savory Snack': 'Khô & đồ nhắm mặn',
    'Semi-Dried': 'Hàng một nắng',
    'Snack': 'Snack & bánh gạo',
    'Sports': 'Nước bù khoáng & thể thao',
    'Tea': 'Trà túi lọc & đóng chai',
    'Vitamin': 'Nước bổ sung Vitamin',
    'Water': 'Nước tinh khiết & khoáng',
  },
};

const SIZE_ORDER: Record<string, number> = {
  'Small': 1,
  'Medium': 2,
  'Large': 3,
  'Extra Large': 4,
};

function parseWeightInGrams(w: string): number {
  const num = parseFloat(w.replace(',', '.'));
  if (isNaN(num)) return 999999;
  if (/kg/i.test(w)) return num * 1000;
  if (/l$/i.test(w)) return num * 1000;
  if (/ml/i.test(w)) return num;
  return num;
}

export function getFacetLabel(field: string, val: string): string {
  return FACET_LABEL_MAP[field]?.[val] || val;
}

@Component({
  selector: 'app-ordering',
  standalone: true,
  imports: [CommonModule, ShellComponent, RouterLink],
  templateUrl: './ordering.component.html',
  styleUrl: './ordering.component.css',
})
export class OrderingComponent implements OnInit {
  protected cart = inject(CartService);

  private productApi = inject(ProductApiService);
  private categoryApi = inject(CategoryApiService);
  private router = inject(Router);
  private route = inject(ActivatedRoute);

  // Dữ liệu MongoDB
  protected allCategories = signal<ApiCategory[]>([]);
  protected allProducts = signal<ApiProduct[]>([]);

  // Danh sách danh mục lấy trực tiếp từ MongoDB
  protected categoryOptions = computed(() =>
    this.allCategories().map(category => ({
      value: category._id,
      label: category.name,
    }))
  );

  // Trả về Category tương ứng với Product
  protected getProductCategory(p: ApiProduct): ApiCategory | undefined {
    return this.allCategories().find(
      category => category._id === p.categoryId
    );
  }

  // Lấy tên Category từ categoryId
  protected getCategoryName(categoryId: string): string {
    return this.allCategories().find(
      category => category._id === categoryId
    )?.name ?? '';
  }

  protected fulfillment = signal<'pickup' | 'delivery'>('pickup');
  protected activeSection = signal('');
  protected loading = signal(true);
  protected error = signal('');

  // Filter state
  protected search = signal('');
  protected maxPrice = signal(300);
  protected sortBy = signal('default');

  protected selectedFilters = signal<Record<string, string[]>>({
    category: [],
    preparation: [],
    ripeness: [],
    sizeGroup: [],
    type: [],
    weight: [],
  });

  // Filter accordion open state
 protected openAccordions = signal<Record<string, boolean>>({
  sort: true,
  price: true,
  category: true,
  preparation: false,
  ripeness: false,
  sizeGroup: false,
  type: false,
  weight: false,
});

    // Các lựa chọn bộ lọc tiếng Việt lấy từ dữ liệu thực tế
  protected facetOptions = computed(() => {
    const targetCat = this.activeCategory();
    const sourceProducts = targetCat === 'all'
      ? this.allProducts()
      : this.allProducts().filter(p => p.categoryId === targetCat);

    const buildFacetList = (field: keyof ApiProduct): FacetOption[] => {
      const counts: Record<string, number> = {};
      for (const p of sourceProducts) {
        const val = p[field] as string;
        if (val) {
          counts[val] = (counts[val] || 0) + 1;
        }
      }

      return Object.keys(counts)
        .sort((a, b) => {
          if (field === 'sizeGroup') {
            const orderA = SIZE_ORDER[a] ?? 99;
            const orderB = SIZE_ORDER[b] ?? 99;
            return orderA - orderB;
          }
          if (field === 'weight') {
            return parseWeightInGrams(a) - parseWeightInGrams(b);
          }
          const labelA = getFacetLabel(field as string, a);
          const labelB = getFacetLabel(field as string, b);
          return labelA.localeCompare(labelB, 'vi');
        })
        .map(val => ({
          value: val,
          label: getFacetLabel(field as string, val),
          count: counts[val],
        }));
    };

    return {
      category: this.allCategories().map(c => ({
        value: c._id,
        label: c.name,
        count: this.allProducts().filter(p => p.categoryId === c._id).length,
      })),
      preparation: buildFacetList('preparation'),
      ripeness: buildFacetList('ripeness'),
      sizeGroup: buildFacetList('sizeGroup'),
      type: buildFacetList('type'),
      weight: buildFacetList('weight'),
    };
  });

  protected maxPriceInDB = computed(() =>
    Math.ceil(
      Math.max(
        ...this.allProducts().map(p => p.priceNumber),
        300
      ) / 50
    ) * 50
  );

  protected hasActiveFilters = computed(() => {
    const f = this.selectedFilters();

    return Object.values(f).some(a => a.length > 0)
      || this.maxPrice() < this.maxPriceInDB()
      || !!this.search();
  });

  // Lọc và sắp xếp sản phẩm
  protected filteredProducts = computed(() => {
    const f = this.selectedFilters();
    const q = this.search().toLowerCase().trim();
    const maxP = this.maxPrice();

    let list = this.allProducts().filter(p => {
      if (
        q &&
        !p.name.toLowerCase().includes(q) &&
        !(p.description || '').toLowerCase().includes(q)
      ) {
        return false;
      }

      if (p.priceNumber > maxP) return false;

      if (
        f['category'].length &&
        !f['category'].includes(p.categoryId)
      ) {
        return false;
      }

      if (
        f['preparation'].length &&
        !f['preparation'].includes(p.preparation)
      ) return false;

      if (
        f['ripeness'].length &&
        !f['ripeness'].includes(p.ripeness)
      ) return false;

      if (
        f['sizeGroup'].length &&
        !f['sizeGroup'].includes(p.sizeGroup)
      ) return false;

      if (
        f['type'].length &&
        !f['type'].includes(p.type)
      ) return false;

      if (
        f['weight'].length &&
        !f['weight'].includes(p.weight)
      ) return false;

      return true;
    });

    if (this.sortBy() === 'price-asc') {
      list = [...list].sort((a, b) => a.priceNumber - b.priceNumber);
    }

    if (this.sortBy() === 'price-desc') {
      list = [...list].sort((a, b) => b.priceNumber - a.priceNumber);
    }

    if (this.sortBy() === 'name-asc') {
      list = [...list].sort((a, b) => a.name.localeCompare(b.name));
    }

    return list;
  });

    // Gom sản phẩm theo đúng Category trong MongoDB
  protected activeCategory = signal('all');
  protected categoryProducts = computed(() => {
    const products = this.filteredProducts();
    const categoryId = this.activeCategory();

    if (this.selectedFilters()['category'].length > 0) {
      return products;
    }

    if (categoryId === 'all') {
      return products;
    }

    return products.filter(p => p.categoryId === categoryId);
  });

  protected selectCategory(categoryId: string): void {
    this.activeCategory.set(categoryId);
    if (this.selectedFilters()['category'].length > 0) {
      this.selectedFilters.update(f => ({ ...f, category: [] }));
    }
  }
  protected sections = computed(() => {
  const products = this.categoryProducts();

  return this.allCategories()
    .map(category => ({
      id: category._id,
      title: category.name,
      items: products.filter(p => p.categoryId === category._id)
    }))
    .filter(section => section.items.length > 0);
});

  ngOnInit(): void {
    const q = this.route.snapshot.queryParamMap.get('q');

    if (q) {
      this.search.set(q);
    }

    // Tải danh mục và sản phẩm
    let categoriesLoaded = false;
    let productsLoaded = false;

    const finishLoading = () => {
      if (categoriesLoaded && productsLoaded) {
        this.loading.set(false);
        this.maxPrice.set(this.maxPriceInDB());

        const cat = this.route.snapshot.queryParamMap.get('category');

        if (cat) {
          this.navigateToCategory(cat);
        } else {
          this.activeSection.set(this.sections()[0]?.id ?? '');
        }
      }
    };

    this.categoryApi.getAll().subscribe({
      next: res => {
        this.allCategories.set(res.data);
        categoriesLoaded = true;
        finishLoading();
      },
      error: err => {
        console.error('Không tải được danh mục:', err);
        this.error.set('Không thể tải danh mục.');
        categoriesLoaded = true;
        finishLoading();
      },
    });

    this.productApi.getAll({
      limit: 0,
      sort: 'createdAt',
    }).subscribe({
      next: res => {
        this.allProducts.set(res.data);
        productsLoaded = true;
        finishLoading();
      },
      error: err => {
        console.error('Không tải được sản phẩm:', err);
        this.error.set('Không thể tải sản phẩm.');
        productsLoaded = true;
        finishLoading();
      },
    });

    // Theo dõi khi query parameter thay đổi
    this.route.queryParamMap.subscribe(params => {
      const cat = params.get('category');
      if (!this.loading()) {
        if (cat) {
          this.navigateToCategory(cat);
        } else {
          this.selectCategory('all');
        }
      }
    });
  }

  // Tìm Category bằng ID, slug hoặc name
  private navigateToCategory(value: string): void {
    const target = normalizeCategoryTarget(value).toLowerCase();

    const category = this.allCategories().find(c =>
      c._id === value ||
      c.slug.toLowerCase() === target ||
      c.slug.toLowerCase() === '/category/' + target ||
      c.name.toLowerCase() === target
    );

    if (category) {
      this.selectCategory(category._id);
      setTimeout(() => this.scrollTo(category._id), 100);
    }
  }

  scrollTo(categoryId: string): void {
    this.activeSection.set(categoryId);

    const el = document.getElementById('section-' + categoryId);

    if (el) {
      const yOffset = -90;
      const y =
        el.getBoundingClientRect().top +
        window.pageYOffset +
        yOffset;

      window.scrollTo({
        top: y,
        behavior: 'smooth',
      });
    }
  }

  toggleAccordion(key: string): void {
    this.openAccordions.update(o => ({
      ...o,
      [key]: !o[key],
    }));
  }

  toggleFilter(facet: string, val: string): void {
    this.selectedFilters.update(f => {
      const arr = f[facet] ?? [];

      return {
        ...f,
        [facet]: arr.includes(val)
          ? arr.filter(x => x !== val)
          : [...arr, val],
      };
    });
  }

  isChecked(facet: string, val: string): boolean {
    return (this.selectedFilters()[facet] ?? []).includes(val);
  }

  clearAllFilters(): void {
    this.selectedFilters.set({
      category: [],
      preparation: [],
      ripeness: [],
      sizeGroup: [],
      type: [],
      weight: [],
    });

    this.search.set('');
    this.maxPrice.set(this.maxPriceInDB());
    this.sortBy.set('default');
  }

  itemQty(slug: string): number {
    return this.cart.items().find(
      i => i.product.slug === slug
    )?.quantity ?? 0;
  }

  addOne(prod: ApiProduct): void {
    this.cart.addItem(toCartProduct(prod), 1);
  }

  removeOne(prod: ApiProduct): void {
    const qty = this.itemQty(prod.slug);

    if (qty > 1) {
      this.cart.updateQuantity(prod.slug, qty - 1);
    } else {
      this.cart.removeItem(prod.slug);
    }
  }

  goToCart(): void {
    this.router.navigate(['/checkout']);
  }
}