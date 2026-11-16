import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  InventoryApiService,
  InventoryItem,
  InventoryLogItem,
  InventorySummary,
} from '../../shared/services/inventory-api.service';
import { CategoryApiService, ApiCategory } from '../../shared/services/category-api.service';

@Component({
  selector: 'app-admin-inventory',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './inventory.component.html',
  styleUrl: './inventory.component.css',
})
export class AdminInventoryComponent implements OnInit {
  protected readonly Math = Math;
  private invApi = inject(InventoryApiService);
  private catApi = inject(CategoryApiService);

  items = signal<InventoryItem[]>([]);
  categories = signal<ApiCategory[]>([]);
  logs = signal<InventoryLogItem[]>([]);
  summary = signal<InventorySummary>({
    totalProducts: 0,
    inStockCount: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
    totalStockQuantity: 0,
  });

  activeTab = signal<'list' | 'logs'>('list');
  loading = signal(false);
  error = signal('');
  successMsg = signal('');

  // Filters & Pagination
  searchQuery = signal('');
  selectedCategory = signal('');
  selectedStatus = signal<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all');
  page = signal(1);
  pageSize = signal(15);
  total = signal(0);
  totalPages = computed(() => Math.ceil(this.total() / this.pageSize()) || 1);

  // Time Filter & Pagination for Logs
  logTimeFilter = signal<'7d' | '30d' | '90d' | 'custom'>('30d');
  logCustomStartDate = signal<string>(new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
  logCustomEndDate = signal<string>(new Date().toISOString().slice(0, 10));
  logPage = signal(1);
  logPageSize = signal(15);
  logTotal = signal(0);
  logTotalPages = computed(() => Math.ceil(this.logTotal() / this.logPageSize()) || 1);

  // Modal
  adjustModalOpen = signal(false);
  selectedProduct = signal<InventoryItem | null>(null);
  adjustMode = signal<'set' | 'delta'>('delta');
  adjustAmount = signal<number>(0);
  adjustReason = signal<string>('Nhập hàng mới');
  adjustNote = signal<string>('');
  submitting = signal(false);

  ngOnInit(): void {
    this.loadCategories();
    this.loadInventory();
  }

  loadCategories(): void {
    this.catApi.getAll().subscribe({
      next: (res) => {
        if (res.success) this.categories.set(res.data);
      },
    });
  }

  loadInventory(): void {
    this.loading.set(true);
    this.error.set('');

    const params: Record<string, string | number> = {
      page: this.page(),
      limit: this.pageSize(),
    };
    if (this.searchQuery()) params['search'] = this.searchQuery();
    if (this.selectedCategory()) params['category'] = this.selectedCategory();
    if (this.selectedStatus() !== 'all') params['status'] = this.selectedStatus();

    this.invApi.getItems(params).subscribe({
      next: (res) => {
        if (res.success) {
          this.items.set(res.data);
          this.total.set(res.total || res.data.length);
          if (res.summary) this.summary.set(res.summary);
        }
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.message || 'Lỗi khi tải dữ liệu tồn kho');
        this.loading.set(false);
      },
    });
  }

  prevPage(): void {
    if (this.page() > 1) {
      this.page.update((p) => p - 1);
      this.loadInventory();
    }
  }

  nextPage(): void {
    if (this.page() < this.totalPages()) {
      this.page.update((p) => p + 1);
      this.loadInventory();
    }
  }

  onFilterChange(): void {
    this.page.set(1);
    this.loadInventory();
  }

  onLogTimeFilterChange(f: '7d' | '30d' | '90d' | 'custom'): void {
    this.logTimeFilter.set(f);
    this.logPage.set(1);
    if (f !== 'custom') {
      this.loadLogs();
    }
  }

  onLogCustomDateChange(type: 'start' | 'end', val: string): void {
    if (type === 'start') this.logCustomStartDate.set(val);
    else this.logCustomEndDate.set(val);

    if (this.logCustomStartDate() && this.logCustomEndDate()) {
      this.logPage.set(1);
      this.loadLogs();
    }
  }

  prevLogPage(): void {
    if (this.logPage() > 1) {
      this.logPage.update((p) => p - 1);
      this.loadLogs();
    }
  }

  nextLogPage(): void {
    if (this.logPage() < this.logTotalPages()) {
      this.logPage.update((p) => p + 1);
      this.loadLogs();
    }
  }

  loadLogs(): void {
    this.loading.set(true);
    const filter = this.logTimeFilter();
    const params: Record<string, string | number> = {
      page: this.logPage(),
      limit: this.logPageSize(),
    };

    if (filter === '7d') params['days'] = 7;
    else if (filter === '30d') params['days'] = 30;
    else if (filter === '90d') params['days'] = 90;
    else if (filter === 'custom') {
      if (this.logCustomStartDate()) params['startDate'] = this.logCustomStartDate();
      if (this.logCustomEndDate()) params['endDate'] = this.logCustomEndDate();
    }

    this.invApi.getLogs(params).subscribe({
      next: (res) => {
        if (res.success) {
          this.logs.set(res.data);
          this.logTotal.set(res.total || 0);
        }
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  exportLogsCsv(): void {
    const filter = this.logTimeFilter();
    const params: Record<string, string | number> = { page: 1, limit: 500 };

    if (filter === '7d') params['days'] = 7;
    else if (filter === '30d') params['days'] = 30;
    else if (filter === '90d') params['days'] = 90;
    else if (filter === 'custom') {
      if (this.logCustomStartDate()) params['startDate'] = this.logCustomStartDate();
      if (this.logCustomEndDate()) params['endDate'] = this.logCustomEndDate();
    }

    this.invApi.getLogs(params).subscribe({
      next: (res) => {
        const data = res.data || [];
        if (!data.length) return;

        const escape = (v: string | number) => `"${String(v ?? '').replace(/"/g, '""')}"`;
        const headers = [
          'Thời gian',
          'Sản phẩm',
          'Loại thay đổi',
          'Biến động',
          'Tồn trước',
          'Tồn sau',
          'Lý do & Ghi chú',
          'Người thực hiện',
        ];

        const formatType = (t: string) => {
          switch (t) {
            case 'import': return 'Nhập kho';
            case 'export': return 'Xuất kho';
            case 'adjustment': return 'Điều chỉnh';
            case 'order_confirmed': return 'Tạo đơn';
            case 'order_cancel': return 'Hủy đơn';
            default: return t;
          }
        };

        const formatDate = (iso: string) => {
          if (!iso) return '';
          const d = new Date(iso);
          const pad = (n: number) => (n < 10 ? '0' + n : String(n));
          return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
        };

        const rows = data.map((l) => [
          escape(formatDate(l.createdAt)),
          escape(l.productName),
          escape(formatType(l.type)),
          escape(l.delta > 0 ? `+${l.delta}` : l.delta),
          escape(l.oldStock),
          escape(l.newStock),
          escape([l.reason, l.note].filter(Boolean).join(' - ')),
          escape(l.updatedBy?.name || 'Admin'),
        ].join(','));

        const csv = '\uFEFF' + [headers.map(escape).join(','), ...rows].join('\r\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `lich-su-ton-kho-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
      }
    });
  }

  switchTab(tab: 'list' | 'logs'): void {
    this.activeTab.set(tab);
    if (tab === 'logs') {
      this.loadLogs();
    } else {
      this.loadInventory();
    }
  }

  openAdjustModal(item: InventoryItem): void {
    this.selectedProduct.set(item);
    this.adjustMode.set('delta');
    this.adjustAmount.set(0);
    this.adjustReason.set('Nhập hàng mới');
    this.adjustNote.set('');
    this.adjustModalOpen.set(true);
  }

  closeAdjustModal(): void {
    this.adjustModalOpen.set(false);
    this.selectedProduct.set(null);
  }

  submitAdjustment(): void {
    const item = this.selectedProduct();
    if (!item) return;

    if (this.adjustMode() === 'delta' && this.adjustAmount() === 0) {
      alert('Vui lòng nhập số lượng thay đổi khác 0');
      return;
    }
    if (this.adjustMode() === 'set' && this.adjustAmount() < 0) {
      alert('Số lượng tồn không thể là số âm');
      return;
    }

    this.submitting.set(true);
    const body = {
      productId: item._id,
      reason: this.adjustReason(),
      note: this.adjustNote(),
      ...(this.adjustMode() === 'delta'
        ? { delta: this.adjustAmount() }
        : { newStock: this.adjustAmount() }),
    };

    this.invApi.adjustStock(body).subscribe({
      next: (res) => {
        this.submitting.set(false);
        if (res.success) {
          this.closeAdjustModal();
          this.successMsg.set(`Đã cập nhật tồn kho cho "${item.name}"`);
          setTimeout(() => this.successMsg.set(''), 4000);
          this.loadInventory();
        }
      },
      error: (err) => {
        this.submitting.set(false);
        alert(err.error?.message || 'Không thể cập nhật tồn kho');
      },
    });
  }

  getStatusBadge(item: InventoryItem): { text: string; cssClass: string } {
    if (item.stock <= 0) {
      return { text: 'Hết hàng', cssClass: 'badge-danger' };
    }
    if (item.stock <= (item.minStock || 10)) {
      return { text: 'Sắp hết hàng', cssClass: 'badge-warning' };
    }
    return { text: 'Còn hàng', cssClass: 'badge-success' };
  }
}

