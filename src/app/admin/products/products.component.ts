import { Component, signal, inject, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ProductApiService, ApiProduct } from '../../shared/services/product-api.service';

type ModalMode = 'create' | 'edit';

const EMPTY_FORM = (): Partial<ApiProduct> => ({
  name: '', slug: '', price: '', priceNumber: 0, category: 'Vegetables',
  categoryVi: '', description: '', image: '', stock: 100,
  container: '', cutType: '', cutting: '', packSize: '',
  packaging: '', preparation: 'Raw', quantity: '', ripeness: '',
  sizeGroup: '', thickness: '', type: 'Fresh', weight: '',
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

  products  = signal<ApiProduct[]>([]);
  total     = signal(0);
  loading   = signal(true);
  saving    = signal(false);
  error     = signal('');
  success   = signal('');

  // filters
  search   = signal('');
  category = signal('');
  sort     = signal('createdAt');
  page     = signal(1);
  readonly limit = 12;

  // view mode
  viewMode = signal<'grid' | 'table'>('grid');

  // modal
  modalOpen = signal(false);
  modalMode = signal<ModalMode>('create');
  editId    = signal('');
  form      = signal<Partial<ApiProduct>>(EMPTY_FORM());

  readonly categories = ['Vegetables', 'Fruits', 'Meat'];
  readonly preparations = ['Raw', 'Marinated'];
  readonly types = ['Fresh', 'Dried'];

  totalPages = computed(() => Math.ceil(this.total() / this.limit));

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    const params: Record<string, string | number> = {
      page: this.page(), limit: this.limit, sort: this.sort(),
    };
    if (this.search())   params['search']   = this.search();
    if (this.category()) params['category'] = this.category();

    console.log('Loading products with params:', params);

    this.productApi.getAll(params).subscribe({
      next: (res) => {
        console.log('Products response:', res);
        console.log('Products count:', res.data?.length);
        this.products.set(res.data);
        this.total.set(res.total);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load products:', err);
        this.error.set(err.error?.message || 'Không thể tải sản phẩm.');
        this.loading.set(false);
      },
    });
  }

  onSearch(val: string): void  { this.search.set(val);   this.page.set(1); this.load(); }
  onCategory(val: string): void{ this.category.set(val); this.page.set(1); this.load(); }
  onSort(val: string): void    { this.sort.set(val);     this.page.set(1); this.load(); }
  prevPage(): void { if (this.page() > 1) { this.page.update(p => p - 1); this.load(); } }
  nextPage(): void { if (this.page() < this.totalPages()) { this.page.update(p => p + 1); this.load(); } }

  openCreate(): void {
    this.form.set(EMPTY_FORM());
    this.modalMode.set('create');
    this.editId.set('');
    this.error.set('');
    this.modalOpen.set(true);
  }

  openEdit(p: ApiProduct): void {
    this.form.set({ ...p });
    this.modalMode.set('edit');
    this.editId.set(p._id);
    this.error.set('');
    this.modalOpen.set(true);
  }

  closeModal(): void { this.modalOpen.set(false); this.error.set(''); }

  setField(key: keyof ApiProduct, val: unknown): void {
    this.form.update(f => ({ ...f, [key]: val }));
  }

  // auto-generate slug from name
  onNameChange(val: string): void {
    this.form.update(f => ({
      ...f, name: val,
      slug: val.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, ''),
    }));
  }

  save(): void {
    const f = this.form();
    if (!f.name || !f.slug || !f.priceNumber) {
      this.error.set('Vui lòng điền đầy đủ thông tin bắt buộc.'); return;
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
        this.success.set(this.modalMode() === 'create' ? 'Đã thêm sản phẩm!' : 'Đã cập nhật!');
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
    if (!confirm(`Xóa sản phẩm "${p.name}"?`)) return;
    this.productApi.remove(p._id).subscribe({
      next: () => { this.success.set('Đã xóa sản phẩm.'); setTimeout(() => this.success.set(''), 3000); this.load(); },
      error: () => this.error.set('Xóa thất bại.'),
    });
  }
}
