import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import {
  ComboAdminSummary,
  ComboApiService,
  ComboStatus,
} from '../../shared/services/combo-api.service';
import {
  ApiComboItem,
  ApiProduct,
  ProductApiService,
} from '../../shared/services/product-api.service';
import { formatPrice } from '../../shared/services/cart.service';

export interface ComboFormItemRow {
  productId: string;
  name: string;
  slug: string;
  image: string;
  priceNumber: number;
  stock: number;
  unit: string;
  weight: string;
  quantity: number;
}

@Component({
  selector: 'app-admin-combos',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink],
  templateUrl: './combos.component.html',
  styleUrl: './combos.component.css',
})
export class AdminCombosComponent implements OnInit {
  private comboApi = inject(ComboApiService);
  private productApi = inject(ProductApiService);

  protected formatPrice = formatPrice;

  // Danh sách Combo & bộ lọc
  combos = signal<ApiProduct[]>([]);
  total = signal(0);
  summary = signal<ComboAdminSummary>({
    totalCombos: 0,
    activeCount: 0,
    pausedCount: 0,
    hiddenCount: 0,
    outOfStockCount: 0,
  });

  loading = signal(true);
  saving = signal(false);
  error = signal('');
  success = signal('');

  search = signal('');
  statusFilter = signal<'all' | ComboStatus | 'out_of_stock'>('all');
  sort = signal('createdAt');
  page = signal(1);
  limit = signal(12);
  viewMode = signal<'table' | 'grid'>('table');

  totalPages = computed(() => Math.ceil(this.total() / this.limit()) || 1);

  // Kho sản phẩm thực tế trong MongoDB để cấu thành Combo
  catalogProducts = signal<ApiProduct[]>([]);
  catalogLoading = signal(false);

  // Modal Xem chi tiết Combo
  detailCombo = signal<ApiProduct | null>(null);

  // Modal Thêm / Chỉnh sửa Combo riêng biệt
  formOpen = signal(false);
  formMode = signal<'create' | 'edit'>('create');
  editComboId = signal('');
  formError = signal('');

  formName = signal('');
  formDescription = signal('');
  formImage = signal('');
  formPriceNumber = signal<number>(0);
  formStatus = signal<ComboStatus>('active');
  formItems = signal<ComboFormItemRow[]>([]);

  // Tìm kiếm thêm sản phẩm & Thay thế sản phẩm trong Combo
  productSearch = signal('');
  replacingRowIndex = signal<number | null>(null);
  replaceSearch = signal('');

  readonly statusLabels: Record<ComboStatus, string> = {
    active: 'Đang kinh doanh',
    paused: 'Tạm ngừng',
    hidden: 'Ẩn',
  };

  filteredCatalogForAdd = computed(() => {
    const q = this.productSearch().trim().toLowerCase();
    const chosenIds = new Set(this.formItems().map((r) => r.productId));
    return this.catalogProducts()
      .filter((p) => {
        if (!p || !p._id || p.isCombo || p.isActive === false) return false;
        if (chosenIds.has(p._id)) return false;
        if (!q) return true;
        return (
          p.name.toLowerCase().includes(q) ||
          (p.slug || '').toLowerCase().includes(q) ||
          (p.categoryVi || '').toLowerCase().includes(q)
        );
      })
      .slice(0, 10);
  });

  filteredCatalogForReplace = computed(() => {
    const rowIdx = this.replacingRowIndex();
    if (rowIdx === null) return [];
    const q = this.replaceSearch().trim().toLowerCase();
    const currentRow = this.formItems()[rowIdx];
    const otherChosenIds = new Set(
      this.formItems()
        .filter((_, idx) => idx !== rowIdx)
        .map((r) => r.productId)
    );
    return this.catalogProducts()
      .filter((p) => {
        if (!p || !p._id || p.isCombo || p.isActive === false) return false;
        if (currentRow && p._id === currentRow.productId) return false;
        if (otherChosenIds.has(p._id)) return false;
        if (!q) return true;
        return (
          p.name.toLowerCase().includes(q) ||
          (p.slug || '').toLowerCase().includes(q) ||
          (p.categoryVi || '').toLowerCase().includes(q)
        );
      })
      .slice(0, 8);
  });

  // Tính toán tự động theo thời gian thực khi Admin thêm/xóa/thay thế/đổi số lượng SP hoặc giá Combo
  formRetailTotal = computed(() =>
    this.formItems().reduce(
      (sum, row) => sum + (Number(row.priceNumber) || 0) * Math.max(1, row.quantity),
      0
    )
  );

  formSavingAmount = computed(() => {
    const retail = this.formRetailTotal();
    const comboPrice = Math.max(0, Number(this.formPriceNumber()) || 0);
    return retail - comboPrice;
  });

  formSavingPercent = computed(() => {
    const retail = this.formRetailTotal();
    const saving = this.formSavingAmount();
    if (retail <= 0 || saving <= 0) return 0;
    return Math.round((saving / retail) * 100);
  });

  formPriceExceedsRetail = computed(() => {
    const items = this.formItems();
    const retail = this.formRetailTotal();
    const comboPrice = Number(this.formPriceNumber()) || 0;
    return items.length > 0 && comboPrice > retail;
  });

  formInventoryCalc = computed(() => {
    const items = this.formItems();
    if (items.length === 0) {
      return {
        availableCombos: 0,
        limitingName: '',
        limitingStock: 0,
        limitingNeed: 0,
      };
    }
    let minCombos = Infinity;
    let limitingName = '';
    let limitingStock = 0;
    let limitingNeed = 1;

    for (const row of items) {
      const qty = Math.max(1, Math.floor(Number(row.quantity) || 1));
      const stock = Math.max(0, Number(row.stock) || 0);
      const possible = Math.floor(stock / qty);
      if (possible < minCombos) {
        minCombos = possible;
        limitingName = row.name;
        limitingStock = stock;
        limitingNeed = qty;
      }
    }

    return {
      availableCombos: Number.isFinite(minCombos) ? minCombos : 0,
      limitingName,
      limitingStock,
      limitingNeed,
    };
  });

  ngOnInit(): void {
    this.loadCombos();
    this.ensureCatalogLoaded();
  }

  ensureCatalogLoaded(): void {
    if (this.catalogProducts().length > 0 || this.catalogLoading()) return;
    this.catalogLoading.set(true);
    this.productApi.getAll({ limit: 0, isCombo: 'false' }).subscribe({
      next: (res) => {
        this.catalogProducts.set(
          (res.data ?? []).filter((p) => !p.isCombo && p.isActive !== false)
        );
        this.catalogLoading.set(false);
      },
      error: () => this.catalogLoading.set(false),
    });
  }

  loadCombos(): void {
    this.loading.set(true);
    this.error.set('');

    const params: Record<string, string | number> = {
      page: this.page(),
      limit: this.limit(),
      sort: this.sort(),
      status: this.statusFilter(),
    };
    if (this.search().trim()) {
      params['search'] = this.search().trim();
    }

    this.comboApi.getAll(params).subscribe({
      next: (res) => {
        this.combos.set(res.data ?? []);
        this.total.set(res.total ?? 0);
        if (res.summary) {
          this.summary.set(res.summary);
        }
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.message || 'Không thể tải danh sách Combo.');
        this.loading.set(false);
      },
    });
  }

  onSearch(val: string): void {
    this.search.set(val);
    this.page.set(1);
    this.loadCombos();
  }

  onStatusFilter(val: string): void {
    this.statusFilter.set((val as any) || 'all');
    this.page.set(1);
    this.loadCombos();
  }

  onSort(val: string): void {
    this.sort.set(val);
    this.page.set(1);
    this.loadCombos();
  }

  prevPage(): void {
    if (this.page() > 1) {
      this.page.update((p) => p - 1);
      this.loadCombos();
    }
  }

  nextPage(): void {
    if (this.page() < this.totalPages()) {
      this.page.update((p) => p + 1);
      this.loadCombos();
    }
  }

  // Helpers hiển thị danh sách & chi tiết
  comboStatusOf(c: ApiProduct): ComboStatus {
    if (c.comboStatus === 'paused') return 'paused';
    if (c.comboStatus === 'hidden') return 'hidden';
    if (c.isActive === false) return 'hidden';
    return 'active';
  }

  comboRetailOf(c: ApiProduct): number {
    if (typeof c.retailTotal === 'number') return c.retailTotal;
    if (typeof c.originalPriceNumber === 'number' && c.originalPriceNumber > 0) {
      return c.originalPriceNumber;
    }
    return (c.comboItems ?? []).reduce(
      (sum, ci) => sum + (ci.product?.priceNumber || 0) * (ci.quantity || 1),
      0
    );
  }

  comboSavingOf(c: ApiProduct): number {
    if (typeof c.savingAmount === 'number') return c.savingAmount;
    return Math.max(0, this.comboRetailOf(c) - (c.priceNumber || 0));
  }

  comboSavingPercentOf(c: ApiProduct): number {
    if (typeof c.savingPercent === 'number') return c.savingPercent;
    const retail = this.comboRetailOf(c);
    const saving = this.comboSavingOf(c);
    return retail > 0 ? Math.round((saving / retail) * 100) : 0;
  }

  comboAvailableOf(c: ApiProduct): number {
    if (typeof c.availableStock === 'number') return c.availableStock;
    return Math.max(0, Number(c.stock ?? 0));
  }

  itemMaxCombos(ci: ApiComboItem): number {
    if (!ci?.product || ci.product.isActive === false) return 0;
    const stock = Math.max(0, Number(ci.product.stock ?? 0));
    const qty = Math.max(1, Number(ci.quantity) || 1);
    return Math.floor(stock / qty);
  }

  // Xem chi tiết Combo
  openDetail(combo: ApiProduct): void {
    this.detailCombo.set(combo);
    // Làm mới dữ liệu thành phần trực tiếp từ MongoDB
    this.comboApi.getById(combo._id).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.detailCombo.set(res.data);
        }
      },
      error: () => {},
    });
  }

  closeDetail(): void {
    this.detailCombo.set(null);
  }

  editFromDetail(): void {
    const current = this.detailCombo();
    if (!current) return;
    this.detailCombo.set(null);
    this.openEdit(current);
  }

  // Mở Form Thêm mới / Chỉnh sửa Combo riêng
  openCreate(): void {
    this.ensureCatalogLoaded();
    this.formMode.set('create');
    this.editComboId.set('');
    this.formName.set('');
    this.formDescription.set('');
    this.formImage.set('');
    this.formPriceNumber.set(0);
    this.formStatus.set('active');
    this.formItems.set([]);
    this.productSearch.set('');
    this.replacingRowIndex.set(null);
    this.replaceSearch.set('');
    this.formError.set('');
    this.formOpen.set(true);
  }

  openEdit(combo: ApiProduct): void {
    this.ensureCatalogLoaded();
    this.formMode.set('edit');
    this.editComboId.set(combo._id);
    this.formName.set(combo.name || '');
    this.formDescription.set(combo.description || '');
    this.formImage.set(combo.image || '');
    this.formPriceNumber.set(Number(combo.priceNumber) || 0);
    this.formStatus.set(this.comboStatusOf(combo));
    this.productSearch.set('');
    this.replacingRowIndex.set(null);
    this.replaceSearch.set('');
    this.formError.set('');

    const mappedRows: ComboFormItemRow[] = (combo.comboItems ?? [])
      .map((ci) => {
        const prod = ci.product;
        if (!prod || !prod._id) return null;
        // Ưu tiên tồn kho & giá mới nhất từ catalog nếu đã tải
        const live = this.catalogProducts().find((x) => x._id === prod._id) || prod;
        return {
          productId: prod._id,
          name: live.name || prod.name,
          slug: live.slug || prod.slug || '',
          image: live.image || prod.image || '',
          priceNumber: Number(live.priceNumber ?? prod.priceNumber) || 0,
          stock: Math.max(0, Number(live.stock ?? prod.stock ?? 0)),
          unit: live.unit || prod.unit || '',
          weight: live.weight || prod.weight || '',
          quantity: Math.max(1, Number(ci.quantity) || 1),
        };
      })
      .filter((r): r is ComboFormItemRow => !!r);

    this.formItems.set(mappedRows);
    this.formOpen.set(true);
  }

  closeForm(): void {
    this.formOpen.set(false);
    this.replacingRowIndex.set(null);
    this.formError.set('');
  }

  // Thao tác trên danh sách sản phẩm thành phần của Combo
  addProductToCombo(p: ApiProduct): void {
    const existingIdx = this.formItems().findIndex((r) => r.productId === p._id);
    if (existingIdx >= 0) {
      this.changeItemQty(existingIdx, 1);
    } else {
      const nextRow: ComboFormItemRow = {
        productId: p._id,
        name: p.name,
        slug: p.slug || '',
        image: p.image || '',
        priceNumber: Number(p.priceNumber) || 0,
        stock: Math.max(0, Number(p.stock ?? 0)),
        unit: p.unit || '',
        weight: p.weight || '',
        quantity: 1,
      };
      this.formItems.update((rows) => [...rows, nextRow]);
      if (!this.formImage().trim() && p.image) {
        this.formImage.set(p.image);
      }
      // Nếu mới tạo Combo và chưa nhập giá, gợi ý mặc định giảm ~10%
      if (this.formMode() === 'create' && this.formPriceNumber() === 0) {
        this.applySuggestedDiscount(10);
      }
    }
    this.productSearch.set('');
    this.formError.set('');
  }

  changeItemQty(idx: number, delta: number): void {
    this.formItems.update((rows) =>
      rows.map((r, i) =>
        i === idx ? { ...r, quantity: Math.max(1, r.quantity + delta) } : r
      )
    );
  }

  setItemQty(idx: number, rawVal: number): void {
    const qty = Math.max(1, Math.floor(Number(rawVal) || 1));
    this.formItems.update((rows) =>
      rows.map((r, i) => (i === idx ? { ...r, quantity: qty } : r))
    );
  }

  startReplaceRow(idx: number): void {
    if (this.replacingRowIndex() === idx) {
      this.replacingRowIndex.set(null);
      this.replaceSearch.set('');
      return;
    }
    this.replacingRowIndex.set(idx);
    this.replaceSearch.set('');
  }

  cancelReplaceRow(): void {
    this.replacingRowIndex.set(null);
    this.replaceSearch.set('');
  }

  confirmReplaceRow(idx: number, newProd: ApiProduct): void {
    this.formItems.update((rows) =>
      rows.map((r, i) =>
        i === idx
          ? {
              productId: newProd._id,
              name: newProd.name,
              slug: newProd.slug || '',
              image: newProd.image || '',
              priceNumber: Number(newProd.priceNumber) || 0,
              stock: Math.max(0, Number(newProd.stock ?? 0)),
              unit: newProd.unit || '',
              weight: newProd.weight || '',
              quantity: r.quantity,
            }
          : r
      )
    );
    this.replacingRowIndex.set(null);
    this.replaceSearch.set('');
    this.formError.set('');
  }

  removeItemRow(idx: number): void {
    this.formItems.update((rows) => rows.filter((_, i) => i !== idx));
    if (this.replacingRowIndex() === idx) {
      this.replacingRowIndex.set(null);
    }
  }

  useComponentImage(imgUrl: string): void {
    if (imgUrl) {
      this.formImage.set(imgUrl);
    }
  }

  applySuggestedDiscount(percent: number): void {
    const retail = this.formRetailTotal();
    if (retail <= 0) return;
    const raw = Math.round((retail * (100 - percent)) / 100 / 1000) * 1000;
    this.formPriceNumber.set(Math.max(1000, Math.min(retail, raw)));
  }

  saveCombo(): void {
    const name = this.formName().trim();
    const priceNumber = Math.round(Number(this.formPriceNumber()) || 0);
    const items = this.formItems();
    const retailTotal = this.formRetailTotal();

    if (!name) {
      this.formError.set('Vui lòng nhập tên Combo.');
      return;
    }
    if (items.length === 0) {
      this.formError.set('Vui lòng chọn ít nhất 1 sản phẩm thành phần đưa vào Combo.');
      return;
    }
    if (priceNumber <= 0) {
      this.formError.set('Vui lòng nhập giá bán Combo lớn hơn 0đ.');
      return;
    }
    if (priceNumber > retailTotal) {
      this.formError.set(
        `Giá bán Combo (${formatPrice(priceNumber)}) không được lớn hơn tổng giá mua lẻ các sản phẩm thành phần (${formatPrice(retailTotal)}).`
      );
      return;
    }

    const payload = {
      name,
      description: this.formDescription().trim(),
      image: this.formImage().trim() || items[0]?.image || '',
      priceNumber,
      comboStatus: this.formStatus(),
      comboItems: items.map((r) => ({
        product: r.productId,
        quantity: Math.max(1, Math.floor(r.quantity)),
      })),
    };

    this.saving.set(true);
    this.formError.set('');

    const req$ =
      this.formMode() === 'create'
        ? this.comboApi.create(payload)
        : this.comboApi.update(this.editComboId(), payload);

    req$.subscribe({
      next: () => {
        this.saving.set(false);
        this.closeForm();
        this.success.set(
          this.formMode() === 'create'
            ? 'Đã tạo gói Combo tiết kiệm mới thành công!'
            : 'Đã cập nhật thông tin & thành phần Combo thành công!'
        );
        setTimeout(() => this.success.set(''), 3500);
        this.loadCombos();
      },
      error: (err) => {
        this.saving.set(false);
        this.formError.set(err.error?.message || 'Không thể lưu Combo.');
      },
    });
  }

  changeComboStatusQuick(combo: ApiProduct, nextStatus: ComboStatus): void {
    if (this.comboStatusOf(combo) === nextStatus) return;
    this.comboApi.updateStatus(combo._id, nextStatus).subscribe({
      next: () => {
        this.success.set(
          `Đã chuyển "${combo.name}" sang trạng thái "${this.statusLabels[nextStatus]}".`
        );
        setTimeout(() => this.success.set(''), 3000);
        this.loadCombos();
      },
      error: (err: any) => {
        this.error.set(err.error?.message || 'Không thể cập nhật trạng thái Combo.');
      },
    });
  }
}
