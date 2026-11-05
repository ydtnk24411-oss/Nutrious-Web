import { Component, OnInit, signal, inject } from '@angular/core';
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

  // Filters
  searchQuery = signal('');
  selectedCategory = signal('');
  selectedStatus = signal<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all');

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
      limit: 100,
    };
    if (this.searchQuery()) params['search'] = this.searchQuery();
    if (this.selectedCategory()) params['category'] = this.selectedCategory();
    if (this.selectedStatus() !== 'all') params['status'] = this.selectedStatus();

    this.invApi.getItems(params).subscribe({
      next: (res) => {
        if (res.success) {
          this.items.set(res.data);
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

  loadLogs(): void {
    this.loading.set(true);
    this.invApi.getLogs({ limit: 50 }).subscribe({
      next: (res) => {
        if (res.success) this.logs.set(res.data);
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
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

