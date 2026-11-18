import { Component, OnInit, OnDestroy, HostListener, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import {
  InventoryApiService,
  InventoryItem,
  InventoryLogItem,
  InventorySummary,
  StockAdjustmentTicket,
  TicketItem,
  SupplierItem,
  SupplierDebtItem,
  StoreInventoryConfig,
} from '../../shared/services/inventory-api.service';
import { CategoryApiService, ApiCategory } from '../../shared/services/category-api.service';
import { DEFAULT_WAREHOUSES, WarehouseLocation } from '../../shared/services/shipping-api.service';
import { AdminAuthService } from '../../shared/services/admin-auth.service';
import { ExportService } from '../../shared/services/export.service';

@Component({
  selector: 'app-admin-inventory',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './inventory.component.html',
  styleUrl: './inventory.component.css',
})
export class AdminInventoryComponent implements OnInit, OnDestroy {
  protected readonly Math = Math;
  protected auth = inject(AdminAuthService);
  private invApi = inject(InventoryApiService);
  private catApi = inject(CategoryApiService);
  private exportService = inject(ExportService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);

  // Role permissions
  isAdmin = computed(() => (this.auth.user()?.role || '').toLowerCase() === 'admin');
  isManager = computed(() => (this.auth.user()?.role || '').toLowerCase() === 'manager');
  isWarehouse = computed(() => (this.auth.user()?.role || '').toLowerCase() === 'warehouse');
  isSales = computed(() => (this.auth.user()?.role || '').toLowerCase() === 'sales');
  canManageClearance = computed(() => ['admin', 'manager'].includes((this.auth.user()?.role || '').toLowerCase()));
  managerStoreId = computed(() => this.auth.user()?.assignedStore || '');

  // Tab State
  activeTab = signal<'list' | 'logs' | 'tickets' | 'debts'>('list');
  loading = signal(false);
  isRefreshing = signal(false);
  error = signal('');
  successMsg = signal('');

  // Tab 1: Product Stock List & Filters
  items = signal<InventoryItem[]>([]);
  categories = signal<ApiCategory[]>([]);
  summary = signal<InventorySummary>({
    totalProducts: 0,
    inStockCount: 0,
    lowStockCount: 0,
    outOfStockCount: 0,
    totalStockQuantity: 0,
  });

  inventoryFilterStoreId = signal<string>('all');
  searchQuery = signal('');
  selectedCategory = signal('');
  selectedType = signal<'all' | 'single' | 'combo'>('all');
  selectedStatus = signal<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all');
  cardFilter = signal<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all');
  showThumbnails = signal(false); // Fast image rendering toggle for low latency!
  page = signal(1);
  pageSize = signal(15);
  total = signal(0);
  totalPages = computed(() => Math.ceil(this.total() / this.pageSize()) || 1);

  hasActiveFilters = computed(() => {
    return Boolean(
      this.searchQuery() ||
      this.selectedCategory() ||
      this.selectedType() !== 'all' ||
      this.selectedStatus() !== 'all' ||
      this.cardFilter() !== 'all' ||
      (this.inventoryFilterStoreId() && this.inventoryFilterStoreId() !== 'all')
    );
  });

  // Tab 2: Logs
  logs = signal<InventoryLogItem[]>([]);
  logTimeFilter = signal<'7d' | '30d' | '90d' | 'custom'>('30d');
  logCustomStartDate = signal<string>(new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10));
  logCustomEndDate = signal<string>(new Date().toISOString().slice(0, 10));
  logTypeFilter = signal<string>('all');
  logSearchQuery = signal<string>('');
  logPage = signal(1);
  logPageSize = signal(15);
  logTotal = signal(0);
  logTotalPages = computed(() => Math.ceil(this.logTotal() / this.logPageSize()) || 1);
  logSummary = computed(() => {
    const list = this.logs();
    let totalImport = 0;
    let totalExport = 0;
    let netDelta = 0;
    for (const l of list) {
      const d = Number(l.delta) || 0;
      if (d > 0) totalImport += d;
      else if (d < 0) totalExport += Math.abs(d);
      netDelta += d;
    }
    return {
      totalLogs: list.length,
      totalImport,
      totalExport,
      netDelta,
    };
  });
  hasActiveLogFilters = computed(() => {
    return Boolean(
      this.logSearchQuery() ||
      this.logTypeFilter() !== 'all' ||
      this.logTimeFilter() !== '30d' ||
      (this.inventoryFilterStoreId() && this.inventoryFilterStoreId() !== 'all')
    );
  });

  // Tab 3: Tickets
  tickets = signal<StockAdjustmentTicket[]>([]);
  loadingTickets = signal(false);
  submittingTicket = signal(false);
  ticketStatusFilter = signal<string>('all');
  ticketTypeFilter = signal<string>('all');
  ticketStoreFilter = signal<string>('all');
  ticketSearchQuery = signal<string>('');
  ticketPage = signal(1);
  ticketPageSize = signal(15);
  ticketTotal = signal(0);
  ticketTotalPages = computed(() => Math.ceil(this.ticketTotal() / this.ticketPageSize()) || 1);
  selectedTicket = signal<StockAdjustmentTicket | null>(null);
  ticketDetailModalOpen = signal(false);
  rejectReasonModalOpen = signal(false);
  rejectReasonText = signal('');

  serverTicketSummary = signal<{ total: number; pending: number; inTransit: number; completed: number } | null>(null);

  ticketSummary = computed(() => {
    const s = this.serverTicketSummary();
    if (s) return { pending: s.pending, inTransit: s.inTransit, completed: s.completed };
    const list = this.tickets();
    const pending = list.filter(t => t.status === 'pending_approval').length;
    const inTransit = list.filter(t => t.status === 'in_transit').length;
    const completed = list.filter(t => t.status === 'completed' || t.status === 'approved').length;
    return { pending, inTransit, completed };
  });

  // Create Ticket Modal
  createTicketModalOpen = signal(false);
  ticketType = signal<'goods_receipt' | 'spoilage_writeoff' | 'cycle_count' | 'boris_return' | 'store_transfer'>('goods_receipt');
  ticketSourceStoreId = signal<string>('store-thuduc');
  ticketTargetStoreId = signal<string>('store-q1');
  ticketSupplierId = signal<string>('');
  ticketSupplierName = signal<string>('');
  ticketNote = signal<string>('');
  ticketItems = signal<Array<{
    productId: string;
    productName: string;
    sku: string;
    quantity: number;
    unitPrice: number;
    batchCode: string;
    expDate: string;
    reason: string;
  }>>([]);
  allCatalogProducts = signal<InventoryItem[]>([]);
  catalogSearchQuery = signal<string>('');
  modalCategoryFilter = signal<string>('all');
  modalTypeFilter = signal<string>('all');
  suppliersList = signal<SupplierItem[]>([]);

  // Tab 4: Debts
  supplierDebts = signal<SupplierDebtItem[]>([]);
  loadingDebts = signal(false);
  debtSearchQuery = signal<string>('');
  debtStatusFilter = signal<'all' | 'has_debt' | 'cleared' | 'paid_off' | 'zero'>('all');
  payDebtModalOpen = signal(false);
  selectedDebtSupplier = signal<SupplierDebtItem | null>(null);
  paymentAmount = signal<number>(0);
  paymentMethod = signal<string>('bank_transfer');
  paymentNote = signal<string>('');
  isSubmittingPayment = signal(false);

  // Aliases for template bindings
  selectedSupplierForPay = this.selectedDebtSupplier;
  payDebtAmount = this.paymentAmount;
  payDebtNote = this.paymentNote;
  selectedTicketDetail = this.selectedTicket;
  ticketStoreId = this.ticketSourceStoreId;

  // Store Config Modal
  storeConfigModalOpen = signal(false);
  savingStoreConfig = signal(false);
  configProduct = signal<InventoryItem | null>(null);
  storesList = signal<WarehouseLocation[]>(DEFAULT_WAREHOUSES);
  selectedStoreId = signal<string>('store-thuduc');
  currentStoreInventory = signal<any>(null);
  loadingStoreConfig = signal(false);
  configSafetyBuffer = signal<number>(2);
  configIsClearanceSale = signal<boolean>(false);
  configClearancePrice = signal<number>(0);
  configStorePrice = signal<number | null>(null);

  // Quick Adjust Modal
  adjustModalOpen = signal(false);
  selectedProduct = signal<InventoryItem | null>(null);
  adjustMode = signal<'set' | 'delta'>('delta');
  adjustAmount = signal<number>(0);
  adjustReason = signal<string>('Nhập hàng mới');
  adjustNote = signal<string>('');
  submitting = signal(false);

  // Export Menu
  exportMenuOpen = signal(false);

  // Clearance Flash Sale State
  clearanceActive = signal(false);
  clearanceCount = signal(0);
  clearanceDiscountPercent = signal(30);
  clearanceLoading = signal(false);

  // Polling timer
  private autoSyncInterval: any = null;

  // Filtered Catalog for Ticket Creation
  filteredCatalogProducts = computed(() => {
    let prods = this.allCatalogProducts();
    const q = this.catalogSearchQuery().toLowerCase().trim();
    if (q) {
      prods = prods.filter(p => p.name.toLowerCase().includes(q) || (p.slug && p.slug.toLowerCase().includes(q)));
    }
    const cat = this.modalCategoryFilter();
    if (cat && cat !== 'all') {
      prods = prods.filter(p => p.category === cat || p.categoryVi === cat);
    }
    const t = this.modalTypeFilter();
    if (t === 'combo') {
      prods = prods.filter(p => p.slug?.startsWith('combo-') || p.name.toLowerCase().includes('combo'));
    } else if (t === 'single') {
      prods = prods.filter(p => !p.slug?.startsWith('combo-') && !p.name.toLowerCase().includes('combo'));
    }
    return prods;
  });

  groupedCatalogProducts = computed(() => {
    const list = this.filteredCatalogProducts();
    const map = new Map<string, InventoryItem[]>();
    for (const p of list) {
      const cat = p.categoryVi || p.category || 'Khác';
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(p);
    }
    return Array.from(map.entries()).map(([category, items]) => ({ category, items }));
  });

  // Filtered Debts
  filteredSupplierDebts = computed(() => {
    let list = this.supplierDebts();
    const q = this.debtSearchQuery().toLowerCase().trim();
    if (q) {
      list = list.filter(d =>
        (d.name && d.name.toLowerCase().includes(q)) ||
        (d.code && d.code.toLowerCase().includes(q)) ||
        (d.phone && d.phone.includes(q))
      );
    }
    const st = this.debtStatusFilter();
    if (st === 'has_debt') {
      list = list.filter(d => (d.remainingDebt || 0) > 0);
    } else if (st === 'cleared' || st === 'paid_off') {
      list = list.filter(d => (d.remainingDebt || 0) <= 0 && (d.totalAmount || 0) > 0);
    } else if (st === 'zero') {
      list = list.filter(d => (d.totalAmount || 0) === 0);
    }
    return list;
  });

  debtSummary = computed(() => {
    const list = this.supplierDebts();
    let totalInboundOrders = 0;
    let totalInboundAmount = 0;
    let totalPaidAmount = 0;
    let totalRemainingDebt = 0;
    for (const d of list) {
      totalInboundOrders += d.totalInboundOrders || 0;
      totalInboundAmount += d.totalAmount || 0;
      totalPaidAmount += d.paidAmount || 0;
      totalRemainingDebt += d.remainingDebt || 0;
    }
    return {
      totalSuppliers: list.length,
      totalInboundOrders,
      totalInboundAmount,
      totalPaidAmount,
      totalRemainingDebt,
    };
  });

  ngOnInit(): void {
    if (this.isManager() || this.isWarehouse()) {
      const uStore = this.managerStoreId() || 'store-q1';
      this.inventoryFilterStoreId.set(uStore);
      this.selectedStoreId.set(uStore);
      this.ticketStoreFilter.set(uStore);
      this.ticketSourceStoreId.set(uStore);
    }

    this.route.queryParams.subscribe(params => {
      if (params['storeId']) {
        this.inventoryFilterStoreId.set(params['storeId']);
        this.selectedStoreId.set(params['storeId']);
        this.ticketStoreFilter.set(params['storeId']);
      }
      if (params['tab'] && ['list', 'logs', 'tickets', 'debts'].includes(params['tab'])) {
        this.activeTab.set(params['tab'] as any);
      }
      this.refreshCurrentTab();
    });

    this.loadCategories();
    this.loadClearanceStatus();

    // Background polling every 15s
    this.autoSyncInterval = setInterval(() => {
      if (!this.adjustModalOpen() && !this.createTicketModalOpen() && !this.storeConfigModalOpen() && !this.payDebtModalOpen()) {
        this.refreshCurrentTab(true);
      }
    }, 15000);
  }

  ngOnDestroy(): void {
    if (this.autoSyncInterval) {
      clearInterval(this.autoSyncInterval);
    }
  }

  @HostListener('window:focus')
  onWindowFocus(): void {
    this.refreshCurrentTab(true);
  }

  getEffectiveStoreId(): string {
    const sId = this.inventoryFilterStoreId();
    if (sId && sId !== 'all') return sId;
    if (this.isManager() || this.isWarehouse()) {
      return this.managerStoreId() || 'all';
    }
    return 'all';
  }

  loadClearanceStatus(): void {
    const sId = this.getEffectiveStoreId();
    this.invApi.getClearanceStatus(sId !== 'all' ? sId : undefined).subscribe({
      next: (res) => {
        if (res.success) {
          this.clearanceActive.set(res.active);
          this.clearanceCount.set(res.count);
          this.clearanceDiscountPercent.set(Math.round((res.discountPercent || 0.3) * 100));
        }
      },
      error: () => {}
    });
  }

  triggerClearanceAction(): void {
    const sId = this.getEffectiveStoreId();
    this.clearanceLoading.set(true);
    this.invApi.triggerClearance(0.3, sId !== 'all' ? sId : undefined).subscribe({
      next: (res) => {
        this.clearanceLoading.set(false);
        this.loadClearanceStatus();
        this.loadInventory();
      },
      error: (err) => {
        this.clearanceLoading.set(false);
        alert(err?.error?.message || 'Không thể kích hoạt xả hàng cuối ngày.');
      }
    });
  }

  resetClearanceAction(): void {
    const sId = this.getEffectiveStoreId();
    this.clearanceLoading.set(true);
    this.invApi.resetClearance(sId !== 'all' ? sId : undefined).subscribe({
      next: (res) => {
        this.clearanceLoading.set(false);
        this.loadClearanceStatus();
        this.loadInventory();
      },
      error: (err) => {
        this.clearanceLoading.set(false);
        alert(err?.error?.message || 'Không thể kết thúc xả hàng.');
      }
    });
  }

  onStoreFilterChange(storeId: string): void {
    this.inventoryFilterStoreId.set(storeId);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { storeId: storeId === 'all' ? null : storeId },
      queryParamsHandling: 'merge',
    });
    this.page.set(1);
    this.loadInventory();
  }

  refreshCurrentTab(silent: boolean = false): void {
    const tab = this.activeTab();
    if (tab === 'list') this.loadInventory(silent);
    else if (tab === 'logs') this.loadLogs(silent);
    else if (tab === 'tickets') this.loadTickets(silent);
    else if (tab === 'debts') this.loadSupplierDebts(silent);
  }

  onTabChange(tab: 'list' | 'logs' | 'tickets' | 'debts'): void {
    this.activeTab.set(tab);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { tab },
      queryParamsHandling: 'merge',
    });
    this.refreshCurrentTab();
  }

  switchTab(tab: 'list' | 'logs' | 'tickets' | 'debts'): void {
    this.onTabChange(tab);
  }

  toggleShowThumbnails(): void {
    this.showThumbnails.update(v => !v);
  }

  viewProductLogs(item: InventoryItem): void {
    this.logSearchQuery.set(item.name);
    this.activeTab.set('logs');
    this.logPage.set(1);
    this.loadLogs();
  }

  // ── TAB 1: PRODUCT INVENTORY ─────────────────────────────────────
  loadInventory(silent: boolean = false): void {
    if (!silent) this.loading.set(true);
    else this.isRefreshing.set(true);
    this.error.set('');

    const params: Record<string, string | number> = {
      page: this.page(),
      limit: this.pageSize(),
    };
    const sId = this.getEffectiveStoreId();
    if (sId && sId !== 'all') params['storeId'] = sId;
    if (this.searchQuery()) params['search'] = this.searchQuery();
    if (this.selectedCategory()) params['category'] = this.selectedCategory();
    if (this.selectedType() !== 'all') params['type'] = this.selectedType();
    if (this.selectedStatus() !== 'all') params['status'] = this.selectedStatus();
    if (this.cardFilter() !== 'all') params['status'] = this.cardFilter();

    this.invApi.getItems(params).subscribe({
      next: (res) => {
        if (res.success) {
          this.items.set(res.data);
          this.total.set(res.total || res.data.length);
          if (res.summary) this.summary.set(res.summary);
        }
        this.loading.set(false);
        this.isRefreshing.set(false);
      },
      error: (err) => {
        if (!silent) this.error.set(err.error?.message || 'Không thể tải danh sách tồn kho.');
        this.loading.set(false);
        this.isRefreshing.set(false);
      },
    });
  }

  loadCategories(): void {
    this.catApi.getAll().subscribe({
      next: (res) => {
        if (res.success) this.categories.set(res.data);
      },
    });
  }

  loadAllCatalogProducts(): void {
    this.invApi.getItems({ limit: 500, page: 1 }).subscribe({
      next: (res) => {
        if (res.success) this.allCatalogProducts.set(res.data);
      },
    });
  }

  onFilterChange(): void {
    this.page.set(1);
    this.loadInventory();
  }

  onCardFilter(status: 'all' | 'in_stock' | 'low_stock' | 'out_of_stock'): void {
    this.cardFilter.set(status);
    this.page.set(1);
    this.loadInventory();
  }

  resetFilters(): void {
    this.searchQuery.set('');
    this.selectedCategory.set('');
    this.selectedType.set('all');
    this.selectedStatus.set('all');
    this.cardFilter.set('all');
    this.page.set(1);
    this.loadInventory();
  }

  resetAllFilters(): void {
    this.resetFilters();
  }

  prevPage(): void {
    if (this.page() > 1) {
      this.page.update(p => p - 1);
      this.loadInventory();
    }
  }

  nextPage(): void {
    if (this.page() < this.totalPages()) {
      this.page.update(p => p + 1);
      this.loadInventory();
    }
  }

  onPageChange(p: number): void {
    if (p < 1 || p > this.totalPages()) return;
    this.page.set(p);
    this.loadInventory();
  }

  // ── TAB 2: LOGS ──────────────────────────────────────────────────
  loadLogs(silent: boolean = false): void {
    if (!silent) this.loading.set(true);
    else this.isRefreshing.set(true);

    const params: Record<string, string | number> = {
      page: this.logPage(),
      limit: this.logPageSize(),
    };
    const sId = this.getEffectiveStoreId();
    if (sId && sId !== 'all') params['storeId'] = sId;
    if (this.logTypeFilter() !== 'all') params['type'] = this.logTypeFilter();
    if (this.logSearchQuery()) params['search'] = this.logSearchQuery();

    if (this.logTimeFilter() === 'custom') {
      if (this.logCustomStartDate()) params['startDate'] = this.logCustomStartDate();
      if (this.logCustomEndDate()) params['endDate'] = this.logCustomEndDate();
    } else {
      const daysMap: Record<string, number> = { '7d': 7, '30d': 30, '90d': 90 };
      params['days'] = daysMap[this.logTimeFilter()] || 30;
    }

    this.invApi.getLogs(params).subscribe({
      next: (res) => {
        if (res.success) {
          this.logs.set(res.data);
          this.logTotal.set(res.total);
        }
        this.loading.set(false);
        this.isRefreshing.set(false);
      },
      error: () => {
        if (!silent) this.error.set('Không thể tải nhật ký biến động kho.');
        this.loading.set(false);
        this.isRefreshing.set(false);
      },
    });
  }

  onLogSearch(query: string): void {
    this.logSearchQuery.set(query);
    this.logPage.set(1);
    this.loadLogs();
  }

  onLogTypeChange(type: string): void {
    this.logTypeFilter.set(type);
    this.logPage.set(1);
    this.loadLogs();
  }

  onLogStoreChange(storeId: string): void {
    this.inventoryFilterStoreId.set(storeId);
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { storeId: storeId === 'all' ? null : storeId },
      queryParamsHandling: 'merge',
    });
    this.logPage.set(1);
    this.loadLogs();
  }

  resetLogFilters(): void {
    this.logSearchQuery.set('');
    this.logTypeFilter.set('all');
    this.logTimeFilter.set('30d');
    this.inventoryFilterStoreId.set('all');
    this.router.navigate([], {
      relativeTo: this.route,
      queryParams: { storeId: null },
      queryParamsHandling: 'merge',
    });
    this.logPage.set(1);
    this.loadLogs();
  }

  onLogTimeFilterChange(filter: '7d' | '30d' | '90d' | 'custom'): void {
    this.logTimeFilter.set(filter);
    this.logPage.set(1);
    this.loadLogs();
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
      this.logPage.update(p => p - 1);
      this.loadLogs();
    }
  }

  nextLogPage(): void {
    if (this.logPage() < this.logTotalPages()) {
      this.logPage.update(p => p + 1);
      this.loadLogs();
    }
  }

  onLogPageChange(p: number): void {
    if (p < 1 || p > this.logTotalPages()) return;
    this.logPage.set(p);
    this.loadLogs();
  }

  // ── TAB 3: TICKETS ───────────────────────────────────────────────
  loadTickets(silent: boolean = false): void {
    if (!silent) this.loadingTickets.set(true);

    const params: Record<string, string | number> = {
      page: this.ticketPage(),
      limit: this.ticketPageSize(),
    };
    if (this.ticketStoreFilter() && this.ticketStoreFilter() !== 'all') {
      params['storeId'] = this.ticketStoreFilter();
    } else {
      const sId = this.getEffectiveStoreId();
      if (sId && sId !== 'all') params['storeId'] = sId;
    }
    if (this.ticketStatusFilter() !== 'all') params['status'] = this.ticketStatusFilter();
    if (this.ticketTypeFilter() !== 'all') params['type'] = this.ticketTypeFilter();
    if (this.ticketSearchQuery()) params['search'] = this.ticketSearchQuery();

    this.invApi.getAdjustmentTickets(params).subscribe({
      next: (res) => {
        if (res.success) {
          this.tickets.set(res.data);
          this.ticketTotal.set(res.total);
          if (res.summary) {
            this.serverTicketSummary.set(res.summary);
          }
        }
        this.loadingTickets.set(false);
      },
      error: () => {
        this.loadingTickets.set(false);
      },
    });
  }

  openTicketDetail(ticket: StockAdjustmentTicket): void {
    this.selectedTicket.set(ticket);
    this.ticketDetailModalOpen.set(true);
    if (!ticket.items || ticket.items.length === 0 || !ticket.items[0]?.productName) {
      this.invApi.getTicketById(ticket._id).subscribe({
        next: (res) => {
          if (res.success && res.data) {
            this.selectedTicket.set(res.data);
          }
        },
      });
    }
  }

  closeTicketDetail(): void {
    this.ticketDetailModalOpen.set(false);
    this.selectedTicket.set(null);
  }

  approveTicket(ticket: StockAdjustmentTicket): void {
    if (!confirm(`Bạn có chắc chắn muốn duyệt phiếu ${ticket.ticketCode}?`)) return;
    this.invApi.approveTicket(ticket._id).subscribe({
      next: (res) => {
        alert(res.message || 'Duyệt phiếu thành công!');
        this.closeTicketDetail();
        this.loadTickets();
        this.loadInventory();
      },
      error: (err) => {
        alert(err.error?.message || 'Không thể duyệt phiếu!');
      },
    });
  }

  rejectTicket(ticket: StockAdjustmentTicket): void {
    this.openRejectModal(ticket);
  }

  openRejectModal(ticket: StockAdjustmentTicket): void {
    this.selectedTicket.set(ticket);
    this.rejectReasonText.set('');
    this.rejectReasonModalOpen.set(true);
  }

  closeRejectModal(): void {
    this.rejectReasonModalOpen.set(false);
    this.rejectReasonText.set('');
  }

  confirmRejectTicket(): void {
    const t = this.selectedTicket();
    if (!t) return;
    this.invApi.rejectTicket(t._id, this.rejectReasonText()).subscribe({
      next: (res) => {
        alert(res.message || 'Đã từ chối phiếu!');
        this.closeRejectModal();
        this.closeTicketDetail();
        this.loadTickets();
      },
      error: (err) => {
        alert(err.error?.message || 'Không thể từ chối phiếu!');
      },
    });
  }

  canReceiveTransfer(ticket: StockAdjustmentTicket): boolean {
    if (ticket.type !== 'store_transfer' || ticket.status !== 'in_transit') return false;
    const uRole = (this.auth.user()?.role || '').toLowerCase();
    const uStore = this.auth.user()?.assignedStore;
    if (uRole === 'admin') return true;
    if (['manager', 'warehouse'].includes(uRole)) {
      return uStore === ticket.targetStoreId;
    }
    return false;
  }

  confirmReceiveTransfer(ticket: StockAdjustmentTicket): void {
    if (!confirm(`Xác nhận đã nhận đủ hàng cho phiếu điều chuyển ${ticket.ticketCode}?`)) return;
    this.invApi.receiveTransfer(ticket._id).subscribe({
      next: (res) => {
        alert(res.message || 'Xác nhận nhập kho thành công!');
        this.closeTicketDetail();
        this.loadTickets();
        this.loadInventory();
      },
      error: (err) => {
        alert(err.error?.message || 'Không thể xác nhận nhận hàng!');
      },
    });
  }

  openCreateTicketModal(type: 'goods_receipt' | 'spoilage_writeoff' | 'cycle_count' | 'boris_return' | 'store_transfer'): void {
    this.ticketType.set(type);
    let sId = this.getEffectiveStoreId();
    if (!sId || sId === 'all') sId = this.storesList()[0]?.id || 'store-thuduc';
    this.ticketSourceStoreId.set(sId);

    // Target store for transfers
    const otherStore = this.storesList().find(s => s.id !== sId);
    this.ticketTargetStoreId.set(otherStore?.id || 'store-q1');

    this.ticketItems.set([]);
    this.ticketNote.set('');
    this.ticketSupplierId.set('');
    this.ticketSupplierName.set('');
    this.createTicketModalOpen.set(true);

    if (this.allCatalogProducts().length === 0) {
      this.loadAllCatalogProducts();
    }
    if (type === 'goods_receipt') {
      this.loadSuppliers();
    }
  }

  closeCreateTicketModal(): void {
    this.createTicketModalOpen.set(false);
    this.ticketItems.set([]);
  }

  addTicketRow(product?: InventoryItem): void {
    const prod = product || this.allCatalogProducts()[0];
    if (!prod) return;

    const existing = this.ticketItems().find(r => r.productId === prod._id);
    if (existing) {
      existing.quantity += 1;
      this.ticketItems.set([...this.ticketItems()]);
      return;
    }
    let defaultReason = 'Nhập hàng từ nhà cung cấp';
    if (this.ticketType() === 'spoilage_writeoff') defaultReason = 'Hàng dập nát, hỏng';
    else if (this.ticketType() === 'cycle_count') defaultReason = 'Kiểm kê định kỳ';
    else if (this.ticketType() === 'store_transfer') defaultReason = 'Điều chuyển kho';
    else if (this.ticketType() === 'boris_return') defaultReason = 'Thu hồi đổi trả từ khách';

    const unitPrice = prod.costPrice || Math.round(prod.priceNumber * 0.7) || 20000;
    const todayStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const defaultBatch = `LOT-${prod.slug?.toUpperCase().slice(0, 6) || 'ITEM'}-${todayStr}`;
    const defaultExp = new Date(Date.now() + 14 * 86400000).toISOString().slice(0, 10);

    this.ticketItems.update(rows => [
      ...rows,
      {
        productId: prod._id,
        productName: prod.name,
        sku: prod.slug || prod._id,
        quantity: 1,
        unitPrice,
        batchCode: defaultBatch,
        expDate: defaultExp,
        reason: defaultReason,
      },
    ]);
  }

  onTicketProductSelect(index: number, productId: string): void {
    const prod = this.allCatalogProducts().find(p => p._id === productId);
    if (!prod) return;
    this.ticketItems.update(rows => {
      const updated = [...rows];
      if (updated[index]) {
        updated[index] = {
          ...updated[index],
          productId: prod._id,
          productName: prod.name,
          sku: prod.slug || prod._id,
          unitPrice: prod.costPrice || Math.round(prod.priceNumber * 0.7) || 20000,
        };
      }
      return updated;
    });
  }

  removeTicketRow(index: number): void {
    this.ticketItems.update(rows => rows.filter((_, i) => i !== index));
  }

  submitTicket(): void {
    const rows = this.ticketItems();
    if (rows.length === 0) {
      alert('Vui lòng chọn ít nhất 1 sản phẩm vào phiếu');
      return;
    }
    for (const r of rows) {
      if (r.quantity <= 0) {
        alert(`Số lượng cho mặt hàng "${r.productName}" phải lớn hơn 0`);
        return;
      }
    }

    const type = this.ticketType();
    if (type === 'goods_receipt' && !this.ticketSupplierId()) {
      alert('Vui lòng chọn nhà cung cấp đối tác cho phiếu nhập');
      return;
    }

    if (type === 'store_transfer' && this.ticketSourceStoreId() === this.ticketTargetStoreId()) {
      alert('Kho nguồn và kho nhận không được trùng nhau');
      return;
    }

    this.submittingTicket.set(true);
    const payload = {
      storeId: this.ticketSourceStoreId(),
      storeName: this.getStoreDisplayName(this.ticketSourceStoreId()),
      targetStoreId: type === 'store_transfer' ? this.ticketTargetStoreId() : undefined,
      targetStoreName: type === 'store_transfer' ? this.getStoreDisplayName(this.ticketTargetStoreId()) : undefined,
      supplierId: type === 'goods_receipt' ? this.ticketSupplierId() : undefined,
      supplierName: type === 'goods_receipt' ? this.ticketSupplierName() : undefined,
      type,
      note: this.ticketNote(),
      items: rows.map(r => ({
        productId: r.productId,
        quantityDelta: type === 'spoilage_writeoff' ? -Math.abs(r.quantity) : Math.abs(r.quantity),
        unitPrice: r.unitPrice,
        batchCode: r.batchCode,
        expDate: r.expDate || null,
        reason: r.reason,
      })),
    };

    this.invApi.createTicket(payload).subscribe({
      next: (res) => {
        this.submittingTicket.set(false);
        alert(res.message || 'Tạo phiếu thành công!');
        this.closeCreateTicketModal();
        this.loadTickets();
        this.loadInventory();
      },
      error: (err) => {
        this.submittingTicket.set(false);
        alert(err.error?.message || 'Không thể tạo phiếu điều chỉnh');
      },
    });
  }

  onSupplierChange(supplierId: string): void {
    this.ticketSupplierId.set(supplierId);
    const s = this.suppliersList().find(sup => sup._id === supplierId);
    this.ticketSupplierName.set(s ? s.name : '');
  }

  loadSuppliers(): void {
    this.invApi.getSuppliers().subscribe({
      next: (res) => {
        if (res.success) this.suppliersList.set(res.data);
      },
    });
  }

  openCreateTicketForSupplier(sup: SupplierDebtItem): void {
    this.openCreateTicketModal('goods_receipt');
    this.ticketSupplierId.set(sup._id);
    this.ticketSupplierName.set(sup.name);
  }

  // ── TAB 4: DEBTS ─────────────────────────────────────────────────
  loadSupplierDebts(silent: boolean = false): void {
    if (!silent) this.loadingDebts.set(true);
    this.invApi.getSupplierDebts().subscribe({
      next: (res) => {
        if (res.success) this.supplierDebts.set(res.data);
        this.loadingDebts.set(false);
      },
      error: () => {
        this.loadingDebts.set(false);
      },
    });
  }

  openPayDebtModal(item: SupplierDebtItem): void {
    if (!this.isAdmin()) {
      alert('Chỉ Quản trị viên (Admin) hoặc Kế toán mới có quyền thực hiện thanh toán công nợ nhà cung cấp.');
      return;
    }
    this.selectedDebtSupplier.set(item);
    this.paymentAmount.set(item.remainingDebt || 0);
    this.paymentMethod.set('bank_transfer');
    this.paymentNote.set(`Thanh toán tiền hàng cho ${item.name}`);
    this.payDebtModalOpen.set(true);
  }

  closePayDebtModal(): void {
    this.payDebtModalOpen.set(false);
    this.selectedDebtSupplier.set(null);
  }

  submitSupplierPayment(): void {
    if (!this.isAdmin()) {
      alert('Chỉ Quản trị viên (Admin) hoặc Kế toán mới có quyền thanh toán công nợ.');
      return;
    }
    const s = this.selectedDebtSupplier();
    if (!s) return;
    const amt = Number(this.paymentAmount());
    if (!amt || amt <= 0) {
      alert('Vui lòng nhập số tiền thanh toán hợp lệ');
      return;
    }
    this.isSubmittingPayment.set(true);
    this.invApi.recordSupplierPayment({
      supplierId: s._id,
      amount: amt,
      paymentMethod: this.paymentMethod(),
      note: this.paymentNote(),
    }).subscribe({
      next: (res) => {
        this.isSubmittingPayment.set(false);
        alert(res.message || 'Ghi nhận thanh toán thành công!');
        this.closePayDebtModal();
        this.loadSupplierDebts();
      },
      error: (err) => {
        this.isSubmittingPayment.set(false);
        alert(err.error?.message || 'Không thể thực hiện thanh toán');
      },
    });
  }

  // ── STORE CONFIG & CLEARANCE MODAL ───────────────────────────────
  openStoreConfigModal(item: InventoryItem): void {
    this.configProduct.set(item);
    let targetStore = this.getEffectiveStoreId();
    if (!targetStore || targetStore === 'all') {
      targetStore = this.storesList()[0]?.id || 'store-thuduc';
    }
    this.selectedStoreId.set(targetStore);
    this.storeConfigModalOpen.set(true);
    this.loadStoreConfig(targetStore, item._id);
  }

  closeStoreConfigModal(): void {
    this.storeConfigModalOpen.set(false);
    this.configProduct.set(null);
    this.currentStoreInventory.set(null);
  }

  onStoreChange(storeId: string): void {
    this.selectedStoreId.set(storeId);
    const prod = this.configProduct();
    if (prod) {
      this.loadStoreConfig(storeId, prod._id);
    }
  }

  loadStoreConfig(storeId: string, productId: string): void {
    this.loadingStoreConfig.set(true);
    this.invApi.getStoreConfig(storeId, productId).subscribe({
      next: (res) => {
        this.loadingStoreConfig.set(false);
        const data = res.data;
        this.currentStoreInventory.set(data);
        this.configSafetyBuffer.set(data?.safetyBuffer ?? 2);
        const hasClearance = typeof data?.storeDiscountPrice === 'number' && data.storeDiscountPrice > 0;
        this.configIsClearanceSale.set(hasClearance);
        const prod = this.configProduct();
        const basePrice = prod?.priceNumber || 50000;
        this.configClearancePrice.set(hasClearance ? data.storeDiscountPrice! : Math.round(basePrice * 0.7));
        this.configStorePrice.set(data?.storePrice ?? null);
      },
      error: () => {
        this.loadingStoreConfig.set(false);
      },
    });
  }

  saveStoreConfig(): void {
    const prod = this.configProduct();
    if (!prod) return;

    if (this.configIsClearanceSale()) {
      const price = Number(this.configClearancePrice());
      if (!price || price <= 0) {
        alert('Vui lòng nhập giá xả hàng hợp lệ (> 0đ)');
        return;
      }
      if (price >= prod.priceNumber) {
        if (!confirm(`Giá xả hàng (${price.toLocaleString('vi-VN')}đ) đang cao hơn hoặc bằng giá gốc (${prod.priceNumber.toLocaleString('vi-VN')}đ). Bạn có chắc chắn muốn lưu?`)) {
          return;
        }
      }
    }

    this.savingStoreConfig.set(true);
    const body = {
      storeId: this.selectedStoreId(),
      productId: prod._id,
      safetyBuffer: Math.max(0, Number(this.configSafetyBuffer()) || 0),
      storeDiscountPrice: this.configIsClearanceSale() ? Number(this.configClearancePrice()) : null,
      storePrice: this.configStorePrice() ? Number(this.configStorePrice()) : null,
    };

    this.invApi.updateStoreConfig(body).subscribe({
      next: (res) => {
        this.savingStoreConfig.set(false);
        alert(res.message || 'Cập nhật cấu hình kho thành công!');
        this.closeStoreConfigModal();
        this.loadInventory();
      },
      error: (err) => {
        this.savingStoreConfig.set(false);
        alert(err.error?.message || 'Không thể lưu cấu hình kho');
      },
    });
  }

  getOnlineAvailableStock(): number {
    const inv = this.currentStoreInventory();
    const stock = inv?.stock ?? inv?.storeStock ?? 0;
    const buffer = this.configSafetyBuffer() || 0;
    return Math.max(0, stock - buffer);
  }

  getClearanceDiscountPercent(): number {
    const prod = this.configProduct();
    if (!prod || !prod.priceNumber) return 0;
    const cPrice = Number(this.configClearancePrice()) || 0;
    if (cPrice >= prod.priceNumber) return 0;
    return Math.round(((prod.priceNumber - cPrice) / prod.priceNumber) * 100);
  }

  // ── QUICK ADJUST MODAL ───────────────────────────────────────────
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
          alert('Cập nhật tồn kho thành công!');
          this.closeAdjustModal();
          this.loadInventory();
          if (this.activeTab() === 'logs') this.loadLogs();
        }
      },
      error: (err) => {
        this.submitting.set(false);
        alert(err.error?.message || 'Không thể cập nhật tồn kho');
      },
    });
  }

  // ── EXPORTING ────────────────────────────────────────────────────
  exportInventory(format: 'xlsx' | 'csv' = 'xlsx'): void {
    const list = this.items();
    if (list.length === 0) return;
    const headers = ['Sản phẩm', 'Danh mục', 'Đơn vị tính', 'Giá nhập (Vốn)', 'Giá bán (VNĐ)', 'Số lượng tồn', 'Mức tối thiểu', 'Trạng thái'];
    const rows = list.map(item => {
      let st = 'Còn hàng';
      if (item.status === 'low_stock') st = 'Sắp hết hàng';
      else if (item.status === 'out_of_stock') st = 'Hết hàng';
      return [
        item.name,
        item.categoryVi || item.category || 'Khác',
        item.unit || '',
        item.costPrice || 0,
        item.priceNumber || 0,
        item.stock,
        item.minStock,
        st,
      ];
    });
    this.exportService.exportTable(headers, rows, 'bao-cao-ton-kho', format);
  }

  exportLogs(format: 'xlsx' | 'csv' = 'xlsx'): void {
    const list = this.logs();
    if (list.length === 0) return;
    const headers = ['Thời gian', 'Chi nhánh / Kho', 'Sản phẩm', 'Loại biến động', 'Thay đổi', 'Tồn trước', 'Tồn sau', 'Lý do & Ghi chú', 'Người thực hiện'];
    const rows = list.map(l => [
      new Date(l.createdAt).toLocaleString('vi-VN'),
      l.storeName || this.getStoreDisplayName(l.storeId),
      typeof l.product === 'object' ? l.product.name : l.productName,
      l.type,
      l.delta > 0 ? `+${l.delta}` : `${l.delta}`,
      l.oldStock,
      l.newStock,
      `${l.reason}${l.note ? ' - ' + l.note : ''}`,
      l.updatedBy?.name || 'Hệ thống',
    ]);
    this.exportService.exportTable(headers, rows, 'nhat-ky-bien-dong-kho', format);
  }

  exportTickets(format: 'xlsx' | 'csv' = 'xlsx'): void {
    const list = this.tickets();
    if (list.length === 0) return;
    const headers = ['Mã phiếu', 'Loại phiếu', 'Kho / Chi nhánh', 'Nhà cung cấp / Kho đích', 'Tổng giá trị', 'Trạng thái', 'Người tạo', 'Ngày tạo'];
    const rows = list.map(t => [
      t.ticketCode,
      this.getTicketTypeBadge(t.type).label,
      t.storeName || this.getStoreDisplayName(t.storeId),
      t.supplierName || (t.targetStoreName || this.getStoreDisplayName(t.targetStoreId)) || '---',
      t.totalAmount || t.totalLossValue || 0,
      this.getTicketStatusBadge(t.status).label,
      t.creatorName || t.createdBy?.name || '---',
      new Date(t.createdAt).toLocaleString('vi-VN'),
    ]);
    this.exportService.exportTable(headers, rows, 'danh-sach-phieu-kho', format);
  }

  exportDebts(format: 'xlsx' | 'csv' = 'xlsx'): void {
    const list = this.filteredSupplierDebts();
    if (list.length === 0) return;
    const headers = ['Mã NCC', 'Tên nhà cung cấp', 'Số điện thoại', 'Tổng đơn nhập', 'Tổng tiền mua hàng', 'Đã thanh toán', 'Công nợ còn lại'];
    const rows = list.map(d => [
      d.code,
      d.name,
      d.phone || '---',
      d.totalInboundOrders || 0,
      d.totalAmount || 0,
      d.paidAmount || 0,
      d.remainingDebt || 0,
    ]);
    this.exportService.exportTable(headers, rows, 'cong-no-nha-cung-cap', format);
  }

  toggleExportMenu(): void {
    this.exportMenuOpen.update(v => !v);
  }

  closeExportMenu(): void {
    this.exportMenuOpen.set(false);
  }

  // ── PRINT TICKET (CHỨNG TỪ KHO CHUẨN KẾ TOÁN) ───────────────────
  printTicket(t?: StockAdjustmentTicket): void {
    const ticket = t || this.selectedTicket();
    if (!ticket) return;

    const printWin = window.open('', '_blank', 'width=850,height=950');
    if (!printWin) {
      alert('Vui lòng cho phép mở popup trình duyệt để xem và in phiếu chứng từ kho.');
      return;
    }

    const fmtMoney = (v?: number) => (v || 0).toLocaleString('vi-VN') + ' ₫';
    const storeName = this.getStoreDisplayName(ticket.storeId);
    const storeObj = this.storesList().find(st => st.id === ticket.storeId);
    const storeAddress = storeObj?.address || 'Hệ thống Evergreen Mart TP.HCM & Dĩ An';

    let docTitle = 'PHIẾU NHẬP KHO NÔNG SẢN';
    let docFormCode = 'Mẫu số: 01 - VT (Ban hành theo TT số 200/2014/TT-BTC)';
    let partnerLabel = 'Nhà cung cấp / Đơn vị giao hàng:';
    let partnerValue = ticket.supplierName || 'Nhà cung cấp nông sản đối tác';
    let partnerRoleTitle = 'NGƯỜI GIAO HÀNG (NCC)';

    if (ticket.type === 'spoilage_writeoff') {
      docTitle = 'BIÊN BẢN TIÊU HỦY NÔNG SẢN HỎNG';
      docFormCode = 'Mẫu số: 05 - VT (Ban hành theo TT số 200/2014/TT-BTC)';
      partnerLabel = 'Bộ phận lập biên bản:';
      partnerValue = 'Tổ kiểm định chất lượng & Bảo quản kho lạnh';
      partnerRoleTitle = 'ĐẠI DIỆN QC / BẢO QUẢN';
    } else if (ticket.type === 'store_transfer') {
      docTitle = 'PHIẾU ĐIỀU CHUYỂN HÀNG HÓA LIÊN KHO';
      docFormCode = 'Mẫu số: 03 - VT (Ban hành theo TT số 200/2014/TT-BTC)';
      partnerLabel = 'Chi nhánh nhận hàng (Đích):';
      partnerValue = ticket.targetStoreName || this.getStoreDisplayName(ticket.targetStoreId);
      partnerRoleTitle = 'NGƯỜI VẬN CHUYỂN';
    } else if (ticket.type === 'cycle_count') {
      docTitle = 'BIÊN BẢN KIỂM KÊ TỒN KHO THỰC TẾ';
      docFormCode = 'Mẫu số: 08 - VT (Ban hành theo TT số 200/2014/TT-BTC)';
      partnerLabel = 'Bộ phận kiểm đếm:';
      partnerValue = 'Ban kiểm kê tài sản & hàng hóa định kỳ';
      partnerRoleTitle = 'ĐẠI DIỆN BAN KIỂM KÊ';
    }

    let totalQuantity = 0;
    let totalAmount = 0;

    const itemsRows = (ticket.items || []).map((it, idx) => {
      const qty = Math.abs(it.quantityDelta || 0);
      const price = it.unitPrice || 0;
      const rowTotal = qty * price;
      totalQuantity += qty;
      totalAmount += rowTotal;

      const expStr = it.expDate ? new Date(it.expDate).toLocaleDateString('vi-VN') : '-';
      const batchStr = it.batchCode || '-';
      const reasonStr = it.reason || (ticket.type === 'goods_receipt' ? 'Nhập kho chuẩn hóa từ NCC' : (ticket.type === 'spoilage_writeoff' ? 'Hàng dập nát/hỏng' : 'Kiểm kê định kỳ'));

      return `
        <tr>
          <td style="text-align:center;padding:7px 5px;border:1px solid #334155;">${idx + 1}</td>
          <td style="padding:7px 8px;border:1px solid #334155;">
            <strong>${it.productName}</strong>
            <div style="font-size:11px;color:#475569;font-family:monospace;">SKU: ${it.sku || 'SP-' + String(it.productId).slice(-6).toUpperCase()}</div>
          </td>
          <td style="text-align:center;padding:7px 5px;border:1px solid #334155;font-weight:700;">${qty.toLocaleString('vi-VN')}</td>
          <td style="text-align:right;padding:7px 6px;border:1px solid #334155;">${fmtMoney(price)}</td>
          <td style="text-align:right;padding:7px 6px;border:1px solid #334155;font-weight:700;">${fmtMoney(rowTotal)}</td>
          <td style="text-align:center;padding:7px 5px;border:1px solid #334155;font-size:11px;">
            <div>${batchStr}</div>
            <div style="color:#475569;">HSD: ${expStr}</div>
          </td>
          <td style="padding:7px 6px;border:1px solid #334155;font-size:11.5px;">${reasonStr}</td>
        </tr>
      `;
    }).join('');

    const finalAmount = totalAmount > 0 ? totalAmount : (ticket.totalAmount || ticket.totalLossValue || 0);
    const amountInWords = this.numberToVietnameseWords(finalAmount);

    const ticketDate = ticket.createdAt ? new Date(ticket.createdAt) : new Date();
    const day = ticketDate.getDate();
    const month = ticketDate.getMonth() + 1;
    const year = ticketDate.getFullYear();

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Chứng Từ Kho #${ticket.ticketCode} - Evergreen Mart</title>
        <style>
          @page { size: A4 portrait; margin: 15mm 15mm 15mm 15mm; }
          * { box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
            color: #0f172a;
            margin: 0;
            padding: 24px;
            font-size: 12.5px;
            line-height: 1.45;
            background: #ffffff;
          }
          .doc-header {
            display: flex;
            justify-content: space-between;
            align-items: flex-start;
            margin-bottom: 20px;
            padding-bottom: 12px;
            border-bottom: 2px solid #0f172a;
          }
          .company-title {
            font-size: 14px;
            font-weight: 800;
            text-transform: uppercase;
            color: #15803d;
            margin: 0 0 2px 0;
          }
          .company-sub {
            font-size: 11.5px;
            color: #334155;
            margin: 0 0 2px 0;
          }
          .form-code-block {
            text-align: right;
            font-size: 11px;
            color: #475569;
          }
          .form-code-block strong {
            display: block;
            font-size: 12px;
            color: #0f172a;
          }
          .doc-title-block {
            text-align: center;
            margin-bottom: 18px;
          }
          .doc-title {
            font-size: 19px;
            font-weight: 900;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            color: #0f172a;
            margin: 0 0 4px 0;
          }
          .doc-meta {
            font-size: 12px;
            font-style: italic;
            color: #475569;
          }
          .info-table {
            width: 100%;
            margin-bottom: 16px;
            font-size: 12.5px;
          }
          .info-table td {
            padding: 3px 0;
            vertical-align: top;
          }
          .info-table td.lbl {
            width: 190px;
            color: #334155;
            font-weight: 600;
          }
          .items-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 16px;
            font-size: 12px;
          }
          .items-table th {
            background: #f1f5f9;
            border: 1px solid #334155;
            padding: 8px 6px;
            font-weight: 700;
            color: #0f172a;
            text-align: center;
          }
          .total-summary-box {
            border: 1px solid #334155;
            background: #f8fafc;
            padding: 10px 14px;
            margin-bottom: 24px;
            display: flex;
            justify-content: space-between;
            align-items: center;
            font-size: 12.5px;
          }
          .signatures-grid {
            display: grid;
            grid-template-columns: repeat(4, 1fr);
            text-align: center;
            margin-top: 32px;
            page-break-inside: avoid;
          }
          .sig-col strong {
            display: block;
            font-size: 12px;
            color: #0f172a;
          }
          .sig-col span {
            font-size: 11px;
            font-style: italic;
            color: #64748b;
          }
          .sig-space {
            height: 65px;
          }
          .sig-name {
            font-weight: 700;
            font-size: 12px;
            color: #0f172a;
          }
          @media print {
            body { padding: 0; }
            .no-print { display: none !important; }
          }
        </style>
      </head>
      <body>
        <div class="doc-header">
          <div>
            <div class="company-title">SIÊU THỊ NÔNG SẢN SẠCH EVERGREEN MART</div>
            <div class="company-sub"><strong>Chi nhánh / Kho:</strong> ${storeName}</div>
            <div class="company-sub"><strong>Địa điểm:</strong> ${storeAddress}</div>
            <div class="company-sub">Hotline CSKH: 1800 6999 - www.evergreenmart.vn</div>
          </div>
          <div class="form-code-block">
            <strong>${docFormCode}</strong>
            <div>Mã chứng từ: <span style="font-weight:700;font-family:monospace;color:#0f172a;">#${ticket.ticketCode}</span></div>
            <div>Ngày: ${day < 10 ? '0' + day : day}/${month < 10 ? '0' + month : month}/${year}</div>
          </div>
        </div>

        <div class="doc-title-block">
          <h1 class="doc-title">${docTitle}</h1>
          <div class="doc-meta">
            Ngày ${day} tháng ${month} năm ${year} - Số phiếu: <strong>#${ticket.ticketCode}</strong>
          </div>
        </div>

        <table class="info-table">
          <tr>
            <td class="lbl">${partnerLabel}</td>
            <td><strong>${partnerValue}</strong></td>
          </tr>
          <tr>
            <td class="lbl">Địa điểm nhập / quản lý:</td>
            <td>${storeName} (${storeAddress})</td>
          </tr>
          <tr>
            <td class="lbl">Người lập chứng từ:</td>
            <td><strong>${ticket.creatorName || ticket.createdBy?.name || 'Thủ kho phụ trách'}</strong> (Chức vụ: Nhân viên Kho)</td>
          </tr>
          <tr>
            <td class="lbl">Lý do / Diễn giải:</td>
            <td>${ticket.note || 'Nhập hàng chuẩn hóa theo hợp đồng cung ứng định kỳ của hệ thống'}</td>
          </tr>
        </table>

        <table class="items-table">
          <thead>
            <tr>
              <th style="width:36px;">STT</th>
              <th style="text-align:left;min-width:180px;">Tên sản phẩm, quy cách</th>
              <th style="width:75px;">Số lượng</th>
              <th style="width:95px;text-align:right;">Đơn giá vốn</th>
              <th style="width:110px;text-align:right;">Thành tiền</th>
              <th style="width:105px;">Mã lô / HSD</th>
              <th style="min-width:120px;text-align:left;">Lý do / Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            ${itemsRows}
          </tbody>
        </table>

        <div class="total-summary-box">
          <div>
            <div>Tổng số mặt hàng: <strong>${ticket.items?.length || 0} mặt hàng</strong> (Tổng cộng: <strong>${totalQuantity.toLocaleString('vi-VN')}</strong> sản phẩm)</div>
            <div style="margin-top:3px;font-style:italic;">Số tiền viết bằng chữ: <strong>${amountInWords}</strong></div>
          </div>
          <div style="text-align:right;">
            <div style="font-size:12px;color:#475569;">Tổng giá trị chứng từ:</div>
            <div style="font-size:18px;font-weight:900;color:#15803d;font-variant-numeric:tabular-nums;">
              ${fmtMoney(finalAmount)}
            </div>
          </div>
        </div>

        <div class="signatures-grid">
          <div class="sig-col">
            <strong>NGƯỜI LẬP PHIẾU</strong>
            <span>(Ký, ghi rõ họ tên)</span>
            <div class="sig-space"></div>
            <div class="sig-name">${ticket.creatorName || ticket.createdBy?.name || 'Thủ kho lập'}</div>
          </div>
          <div class="sig-col">
            <strong>${partnerRoleTitle}</strong>
            <span>(Ký, ghi rõ họ tên)</span>
            <div class="sig-space"></div>
            <div class="sig-name">${partnerValue.includes('Đại diện') ? partnerValue : ('Đại diện ' + partnerValue)}</div>
          </div>
          <div class="sig-col">
            <strong>THỦ KHO NHẬN HÀNG</strong>
            <span>(Ký, ghi rõ họ tên)</span>
            <div class="sig-space"></div>
            <div class="sig-name">Bộ phận Thủ kho (${storeName})</div>
          </div>
          <div class="sig-col">
            <strong>KẾ TOÁN / CHT DUYỆT</strong>
            <span>(Ký, đóng dấu)</span>
            <div class="sig-space"></div>
            <div class="sig-name">${ticket.approverName || 'Cửa hàng trưởng'}</div>
          </div>
        </div>
      </body>
      </html>
    `;

    printWin.document.open();
    printWin.document.write(html);
    printWin.document.close();

    setTimeout(() => {
      printWin.focus();
      printWin.print();
    }, 250);
  }

  // ── HELPERS & BADGES ─────────────────────────────────────────────
  getStoreDisplayName(storeId?: string): string {
    if (!storeId || storeId === 'all') return 'Toàn bộ hệ thống';
    const s = this.storesList().find(st => st.id === storeId);
    return s ? s.name : storeId;
  }

  getStatusBadge(item: any): { text: string; cssClass: string } {
    const status = typeof item === 'string' ? item : item?.status;
    switch (status) {
      case 'in_stock':
        return { text: 'Còn hàng', cssClass: 'badge-success' };
      case 'low_stock':
        return { text: 'Sắp hết hàng', cssClass: 'badge-warning' };
      case 'out_of_stock':
        return { text: 'Hết hàng', cssClass: 'badge-danger' };
      default:
        return { text: 'Không xác định', cssClass: 'badge-muted' };
    }
  }

  getTicketStatusBadge(status: string): { label: string; class: string } {
    switch (status) {
      case 'pending_approval':
        return { label: 'Chờ duyệt', class: 'bg-amber-50 text-amber-700 border-amber-200' };
      case 'approved':
        return { label: 'Đã duyệt', class: 'bg-emerald-50 text-emerald-700 border-emerald-200' };
      case 'rejected':
        return { label: 'Đã từ chối', class: 'bg-rose-50 text-rose-700 border-rose-200' };
      case 'in_transit':
        return { label: 'Đang vận chuyển', class: 'bg-blue-50 text-blue-700 border-blue-200' };
      case 'completed':
        return { label: 'Hoàn tất', class: 'bg-teal-50 text-teal-700 border-teal-200' };
      case 'cancelled':
        return { label: 'Đã hủy', class: 'bg-gray-100 text-gray-500 border-gray-200' };
      default:
        return { label: status, class: 'bg-gray-50 text-gray-700 border-gray-200' };
    }
  }

  getTicketTypeBadge(type: string): { label: string; class: string } {
    switch (type) {
      case 'goods_receipt':
        return { label: 'Nhập kho NCC', class: 'bg-emerald-100 text-emerald-800' };
      case 'spoilage_writeoff':
        return { label: 'Xuất hủy hỏng hóc', class: 'bg-rose-100 text-rose-800' };
      case 'cycle_count':
        return { label: 'Kiểm kê định kỳ', class: 'bg-amber-100 text-amber-800' };
      case 'store_transfer':
        return { label: 'Điều chuyển kho', class: 'bg-purple-100 text-purple-800' };
      case 'boris_return':
        return { label: 'Tái nhập đổi trả', class: 'bg-cyan-100 text-cyan-800' };
      default:
        return { label: type, class: 'bg-gray-100 text-gray-800' };
    }
  }

  getStatusFilterLabel(): string {
    const st = this.cardFilter() !== 'all' ? this.cardFilter() : this.selectedStatus();
    switch (st) {
      case 'in_stock': return 'Còn hàng';
      case 'low_stock': return 'Sắp hết hàng';
      case 'out_of_stock': return 'Hết hàng';
      default: return 'Tất cả trạng thái';
    }
  }

  getTicketTotalQuantity(ticket: StockAdjustmentTicket): number {
    if (!ticket?.items) return 0;
    return ticket.items.reduce((sum, item) => sum + Math.abs(item.quantityDelta || 0), 0);
  }

  getTicketItemsTotal(ticket: StockAdjustmentTicket): number {
    if (ticket?.items && ticket.items.length > 0) {
      const itemsSum = ticket.items.reduce((sum, item) => sum + (Math.abs(item.quantityDelta || 0) * (item.unitPrice || 0)), 0);
      if (itemsSum > 0) return itemsSum;
    }
    if (ticket.totalAmount) return ticket.totalAmount;
    if (ticket.totalLossValue) return ticket.totalLossValue;
    return 0;
  }

  isCurrentStoreSource(ticket: StockAdjustmentTicket): boolean {
    const myStore = this.getEffectiveStoreId();
    if (!myStore || myStore === 'all') return true;
    return ticket.storeId === myStore;
  }

  isCurrentStoreTarget(ticket: StockAdjustmentTicket): boolean {
    const myStore = this.getEffectiveStoreId();
    if (!myStore || myStore === 'all') return true;
    return ticket.targetStoreId === myStore;
  }

  numberToVietnameseWords(num: number): string {
    if (!num || num === 0) return 'Không đồng';
    const units = ['', 'nghìn', 'triệu', 'tỷ', 'nghìn tỷ', 'triệu tỷ'];
    const digits = ['không', 'một', 'hai', 'ba', 'bốn', 'năm', 'sáu', 'bảy', 'tám', 'chín'];

    function readGroup(n: number): string {
      let str = '';
      const h = Math.floor(n / 100);
      const t = Math.floor((n % 100) / 10);
      const u = n % 10;
      if (h > 0) str += digits[h] + ' trăm ';
      if (t > 1) {
        str += digits[t] + ' mươi ';
        if (u === 1) str += 'mốt ';
        else if (u === 5) str += 'lăm ';
        else if (u > 0) str += digits[u] + ' ';
      } else if (t === 1) {
        str += 'mười ';
        if (u === 5) str += 'lăm ';
        else if (u > 0) str += digits[u] + ' ';
      } else if (u > 0) {
        if (h > 0) str += 'lẻ ';
        str += digits[u] + ' ';
      }
      return str.trim();
    }

    let n = Math.abs(num);
    const groups: number[] = [];
    while (n > 0) {
      groups.push(n % 1000);
      n = Math.floor(n / 1000);
    }

    let result = '';
    for (let i = groups.length - 1; i >= 0; i--) {
      if (groups[i] > 0) {
        const groupStr = readGroup(groups[i]);
        result += groupStr + ' ' + units[i] + ' ';
      }
    }
    result = result.trim() + ' đồng';
    return result.charAt(0).toUpperCase() + result.slice(1);
  }
}
