import { Component, signal, inject, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { ProductApiService, ApiProduct } from '../../shared/services/product-api.service';
import { CategoryApiService, ApiCategory } from '../../shared/services/category-api.service';

type ModalMode = 'create' | 'edit';

const EMPTY_FORM = (): Partial<ApiProduct> => ({
  name: '',
  slug: '',
  price: '',
  priceNumber: 0,
  categoryId: '',
  description: '',
  image: '',
  stock: 100,
  container: '',
  cutType: '',
  cutting: '',
  packSize: '',
  packaging: '',
  preparation: 'Raw',
  quantity: '',
  ripeness: '',
  sizeGroup: '',
  thickness: '',
  type: 'Fresh',
  weight: '',
});

@Component({
  selector: 'app-admin-products',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './products.component.html',
  styleUrl: './products.component.css',
})
export class AdminProductsComponent implements OnInit {
  private productApi = inject(ProductApiService);
  private categoryApi = inject(CategoryApiService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  // Tab
  activeTab = signal<'list' | 'categories'>('list');

  // Products Data
  protected categories = signal<ApiCategory[]>([]);
  products = signal<ApiProduct[]>([]);
  total = signal(0);

  loading = signal(true);
  saving = signal(false);
  error = signal('');
  success = signal('');

  // Categories Tab Data
  categoriesWithCounts = signal<ApiCategory[]>([]);
  catLoading = signal(false);
  catModalOpen = signal(false);
  editingCat = signal<ApiCategory | null>(null);
  catFormName = signal('');
  catFormSlug = signal('');
  catFormImage = signal('');
  catFormOrder = signal(0);
  catSubmitting = signal(false);

  // Filters
  search = signal('');
  category = signal('');
  sort = signal('createdAt');
  page = signal(1);
  limit = signal(12);

  // View mode
  viewMode = signal<'grid' | 'table'>('grid');

  // Product Modal
  modalOpen = signal(false);
  modalMode = signal<ModalMode>('create');
  editId = signal('');
  form = signal<Partial<ApiProduct>>(EMPTY_FORM());

  readonly preparations = ['Raw', 'Marinated'];
  readonly types = ['Fresh', 'Dried'];

  totalPages = computed(() =>
    Math.ceil(this.total() / this.limit()) || 1
  );

  ngOnInit(): void {
    this.loadCategories();
    this.load();

    this.route.queryParamMap.subscribe((params) => {
      const tab = params.get('tab');
      if (tab === 'categories') {
        this.activeTab.set('categories');
        this.loadCategoryCounts();
      } else {
        this.activeTab.set('list');
      }
    });
  }

  switchTab(tab: 'list' | 'categories'): void {
    this.activeTab.set(tab);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: tab === 'categories' ? { tab: 'categories' } : {},
    });
    if (tab === 'categories') {
      this.loadCategoryCounts();
    } else {
      this.load();
    }
  }

  loadCategories(): void {
    this.categoryApi.getAll().subscribe({
      next: (res) => {
        this.categories.set(res.data ?? []);
      },
      error: (err) => {
        console.error('Failed to load categories:', err);
      },
    });
  }

  loadCategoryCounts(): void {
    this.catLoading.set(true);
    this.categoryApi.getWithCounts().subscribe({
      next: (res) => {
        if (res.success) this.categoriesWithCounts.set(res.data);
        this.catLoading.set(false);
      },
      error: () => this.catLoading.set(false),
    });
  }

  load(): void {
    this.loading.set(true);
    this.error.set('');

    const params: Record<string, string | number> = {
      page: this.page(),
      limit: this.limit(),
      sort: this.sort(),
    };

    if (this.search()) {
      params['search'] = this.search();
    }
    if (this.category()) {
      params['categoryId'] = this.category();
    }

    this.productApi.getAll(params).subscribe({
      next: (res) => {
        this.products.set(res.data ?? []);
        this.total.set(res.total ?? 0);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load products:', err);
        this.error.set(err.error?.message || 'Không thể tải sản phẩm.');
        this.loading.set(false);
      },
    });
  }

  getCategoryName(cat: any, product?: ApiProduct): string {
    if (product?.categoryVi) return product.categoryVi;
    if (!cat) return 'Chưa phân loại';
    const catId = typeof cat === 'object' && cat?._id ? cat._id.toString() : cat.toString();
    const found = this.categories().find(c => c._id.toString() === catId);
    if (found) return found.name;
    return 'Chưa phân loại';
  }

  onSearch(val: string): void {
    this.search.set(val);
    this.page.set(1);
    this.load();
  }

  onCategory(val: string): void {
    this.category.set(val);
    this.page.set(1);
    this.load();
  }

  onSort(val: string): void {
    this.sort.set(val);
    this.page.set(1);
    this.load();
  }

  onLimitChange(val: number): void {
    this.limit.set(val);
    this.page.set(1);
    this.load();
  }

  prevPage(): void {
    if (this.page() > 1) {
      this.page.update(p => p - 1);
      this.load();
    }
  }

  nextPage(): void {
    if (this.page() < this.totalPages()) {
      this.page.update(p => p + 1);
      this.load();
    }
  }

  openCreate(): void {
    const defaultCat = this.categories().length > 0 ? this.categories()[0]._id : '';
    this.form.set({ ...EMPTY_FORM(), categoryId: defaultCat });
    this.modalMode.set('create');
    this.editId.set('');
    this.error.set('');
    this.modalOpen.set(true);
  }

  openEdit(p: ApiProduct): void {
    const catId = typeof p.categoryId === 'object' && (p.categoryId as any)?._id
      ? (p.categoryId as any)._id.toString()
      : (p.categoryId ? p.categoryId.toString() : '');
    this.form.set({ ...p, categoryId: catId });
    this.modalMode.set('edit');
    this.editId.set(p._id);
    this.error.set('');
    this.modalOpen.set(true);
  }

  closeModal(): void {
    this.modalOpen.set(false);
    this.error.set('');
  }

  setField(key: keyof ApiProduct, val: unknown): void {
    this.form.update(f => ({
      ...f,
      [key]: val,
    }));
  }

  onNameChange(val: string): void {
    this.form.update(f => ({
      ...f,
      name: val,
      slug: val
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, ''),
    }));
  }

  save(): void {
    const f = this.form();

    if (!f.name || !f.slug || !f.priceNumber || !f.categoryId) {
      this.error.set('Vui lòng điền đầy đủ thông tin bắt buộc.');
      return;
    }

    if (!f.price) {
      f.price = f.priceNumber.toLocaleString('vi-VN') + 'đ';
    }

    this.saving.set(true);
    this.error.set('');

    const obs = this.modalMode() === 'create'
      ? this.productApi.create(f)
      : this.productApi.update(this.editId(), f);

    obs.subscribe({
      next: () => {
        this.saving.set(false);
        this.closeModal();

        this.success.set(
          this.modalMode() === 'create'
            ? 'Đã thêm sản phẩm!'
            : 'Đã cập nhật!'
        );

        setTimeout(() => this.success.set(''), 3000);
        this.load();
      },
      error: (err) => {
        this.saving.set(false);
        this.error.set(err.error?.message || 'Lưu thất bại.');
      },
    });
  }

  remove(p: ApiProduct): void {
    if (!confirm(`Xóa sản phẩm "${p.name}"?`)) {
      return;
    }

    this.productApi.remove(p._id).subscribe({
      next: () => {
        this.success.set('Đã xóa sản phẩm.');
        setTimeout(() => this.success.set(''), 3000);
        this.load();
      },
      error: () => {
        this.error.set('Xóa thất bại.');
      },
    });
  }

  // Category Modal Handlers
  openCreateCategory(): void {
    this.editingCat.set(null);
    this.catFormName.set('');
    this.catFormSlug.set('');
    this.catFormImage.set('');
    this.catFormOrder.set(this.categoriesWithCounts().length + 1);
    this.catModalOpen.set(true);
  }

  openEditCategory(cat: ApiCategory): void {
    this.editingCat.set(cat);
    this.catFormName.set(cat.name);
    this.catFormSlug.set(cat.slug);
    this.catFormImage.set(cat.image || '');
    this.catFormOrder.set(cat.order || 0);
    this.catModalOpen.set(true);
  }

  closeCatModal(): void {
    this.catModalOpen.set(false);
    this.editingCat.set(null);
  }

  saveCategory(): void {
    const name = this.catFormName().trim();
    let slug = this.catFormSlug().trim();
    if (!name) {
      alert('Vui lòng nhập tên danh mục');
      return;
    }
    if (!slug) {
      slug = '/category/' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
    }

    this.catSubmitting.set(true);
    const payload = {
      name,
      slug,
      image: this.catFormImage(),
      order: this.catFormOrder(),
    };

    const editItem = this.editingCat();
    const req$ = editItem
      ? this.categoryApi.update(editItem._id, payload)
      : this.categoryApi.create(payload);

    req$.subscribe({
      next: (res) => {
        this.catSubmitting.set(false);
        if (res.success) {
          this.closeCatModal();
          this.success.set('Đã lưu danh mục thành công!');
          setTimeout(() => this.success.set(''), 3000);
          this.loadCategoryCounts();
          this.loadCategories();
        }
      },
      error: (err) => {
        this.catSubmitting.set(false);
        alert(err.error?.message || 'Không thể lưu danh mục.');
      },
    });
  }

  removeCategory(cat: ApiCategory): void {
    if ((cat.productCount || 0) > 0) {
      alert(`Không thể xóa danh mục "${cat.name}" vì đang có ${cat.productCount} sản phẩm liên kết!`);
      return;
    }
    if (!confirm(`Bạn có chắc muốn xóa danh mục "${cat.name}"?`)) return;

    this.categoryApi.remove(cat._id).subscribe({
      next: (res) => {
        if (res.success) {
          this.loadCategoryCounts();
          this.loadCategories();
        }
      },
      error: (err) => alert(err.error?.message || 'Lỗi khi xóa danh mục.'),
    });
  }

  getComboItemName(ci: any): string {
    if (!ci) return '';
    return ci.product?.name || ci.name || 'Sản phẩm';
  }

  getComboItemQty(ci: any): number {
    return ci?.quantity || 1;
  }
}
