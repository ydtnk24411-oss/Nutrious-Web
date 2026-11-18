import { Component, signal, inject, OnInit, OnDestroy, HostListener, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { OrderApiService, ApiOrder } from '../../shared/services/order-api.service';
import { API_BASE } from '../../shared/services/api.service';
import { AdminAuthService } from '../../shared/services/admin-auth.service';

@Component({
  selector: 'app-admin-orders',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './orders.component.html',
  styleUrl: './orders.component.css',
})
export class AdminOrdersComponent implements OnInit, OnDestroy {
  protected auth = inject(AdminAuthService);
  private orderApi = inject(OrderApiService);
  private route = inject(ActivatedRoute);
  private pollTimer: any = null;

  isWarehouse = computed(() => (this.auth.user()?.role || '').toLowerCase() === 'warehouse');
  isAdmin = computed(() => (this.auth.user()?.role || '').toLowerCase() === 'admin');
  isManager = computed(() => (this.auth.user()?.role || '').toLowerCase() === 'manager');
  isSales = computed(() => (this.auth.user()?.role || '').toLowerCase() === 'sales');

  orders   = signal<ApiOrder[]>([]);
  total    = signal(0);
  loading  = signal(true);
  error    = signal('');
  success  = signal('');

  // filters
  search   = signal('');
  status   = signal('');
  page     = signal(1);
  readonly limit = 25;

  // view mode & table controls
  viewMode = signal<'kanban' | 'timeline'>('kanban');
  selectedIds = signal<Set<string>>(new Set());
  sortBy = signal<'date' | 'customer' | 'total' | 'status'>('date');
  sortDir = signal<'asc' | 'desc'>('desc');
  colMenuOpen = signal(false);
  filterMenuOpen = signal(false);
  dateMenuOpen = signal(false);
  exportMenuOpen = signal(false);
  paymentFilter = signal<'' | 'cod' | 'bank_transfer'>('');
  paymentStateFilter = signal<'' | 'paid' | 'unpaid' | 'expired'>('');
  shippingFilter = signal<'' | 'delivery' | 'pickup'>('');
  dateRange = signal<'all' | 'today' | '7d' | '30d'>('all');
  storeFilter = signal<string>('');
  storeMenuOpen = signal(false);

  readonly warehouseList = [
    { id: '', name: 'Tất cả chi nhánh' },
    { id: 'store-thuduc', name: 'Tổng kho Evergreen Mart Thủ Đức' },
    { id: 'store-q1', name: 'Cửa hàng Evergreen Mart Quận 1' },
    { id: 'store-binhthanh', name: 'Cửa hàng Evergreen Mart Bình Thạnh' },
    { id: 'store-q7', name: 'Cửa hàng Evergreen Mart Quận 7' },
    { id: 'store-tanbinh', name: 'Cửa hàng Evergreen Mart Tân Bình' },
    { id: 'store-govap', name: 'Cửa hàng Evergreen Mart Gò Vấp' },
    { id: 'store-binhtan', name: 'Cửa hàng Evergreen Mart Bình Tân' },
    { id: 'store-dian', name: 'Kho Evergreen Mart Dĩ An' },
  ];

  readonly warehouseMap: Record<string, string> = {
    'store-thuduc': 'Tổng kho Thủ Đức',
    'store-q1': 'Cửa hàng Quận 1',
    'store-binhthanh': 'Cửa hàng Bình Thạnh',
    'store-q7': 'Cửa hàng Quận 7',
    'store-tanbinh': 'Cửa hàng Tân Bình',
    'store-govap': 'Cửa hàng Gò Vấp',
    'store-binhtan': 'Cửa hàng Bình Tân',
    'store-dian': 'Kho Dĩ An',
  };

  currentManagerStoreName(): string {
    const sId = this.auth.user()?.assignedStore || 'store-q1';
    const match = this.warehouseList.find(w => w.id === sId);
    return match ? match.name : 'Cửa hàng Evergreen Mart Quận 1';
  }

  getOrderWarehouseName(order: ApiOrder): string {
    if (order.warehouseId && this.warehouseMap[order.warehouseId]) {
      return this.warehouseMap[order.warehouseId];
    }
    if (order.pickupStore?.name) {
      return order.pickupStore.name.replace(' (Trụ sở chính)', '');
    }
    return 'Cửa hàng Quận 1';
  }

  onStoreFilter(v: string): void {
    this.storeFilter.set(v);
    this.page.set(1);
    this.load();
  }
  visibleCols = signal({
    customer: true,
    product: true,
    shipping: true,
    total: true,
    status: true,
  });

  // detail inspector / mobile drawer
  selected    = signal<ApiOrder | null>(null);
  detailOpen  = signal(false);
  updatingStatus = signal(false);
  confirmingPayment = signal(false);
  updatingOrderId = signal<string | null>(null);
  qrOnlyFilter = signal(false);
  lastUpdatedOrderId = signal<string | null>(null);
  recentlyUpdatedIds = signal<Set<string>>(new Set());
  statusCounts = signal<Record<string, number>>({});
  newStatus   = signal('');

  auditLogOpen = signal(false);
  toggleAuditLog(): void {
    this.auditLogOpen.update(v => !v);
  }

  totalPages = computed(() => Math.ceil(this.total() / this.limit));

  pageRevenue = computed(() =>
    this.orders()
      .filter(o => o.status !== 'cancelled')
      .reduce((s, o) => s + o.total, 0)
  );

  pendingQrCount = computed(() =>
    this.orders().filter(o => this.canConfirmQrPayment(o)).length
  );

  readonly statusOptions = [
    { value: 'pending',   label: 'Chờ xử lý'    },
    { value: 'confirmed', label: 'Đã xác nhận'  },
    { value: 'preparing', label: 'Đang chuẩn bị'},
    { value: 'shipping',  label: 'Đang giao'     },
    { value: 'delivered', label: 'Đã giao'       },
    { value: 'cancelled', label: 'Đã hủy'        },
  ];

  readonly statusLabel: Record<string, string> = {
    pending: 'Chờ xử lý', confirmed: 'Đã xác nhận', preparing: 'Đang chuẩn bị',
    shipping: 'Đang giao', delivered: 'Đã giao', cancelled: 'Đã hủy',
  };

  readonly paymentLabel: Record<string, string> = {
    cod: 'COD / Tiền mặt', bank_transfer: 'Chuyển khoản',
  };

  readonly shippingLabel: Record<string, string> = {
    pickup: 'Nhận tại cửa hàng', delivery: 'Giao xe lạnh tận nơi',
  };

  ngOnInit(): void {
    if (this.isManager()) {
      const userStore = this.auth.user()?.assignedStore || 'store-q1';
      this.storeFilter.set(userStore);
    }

    this.route.queryParams.subscribe((params) => {
      if (params['filter'] === 'qr' || params['qr'] === '1' || params['status'] === 'pending_qr') {
        this.qrOnlyFilter.set(true);
        this.status.set('');
      }
    });

    this.load();
    // Đồng bộ đơn hàng mới ngầm mỗi 12 giây
    this.pollTimer = setInterval(() => {
      this.load(true);
    }, 12000);
  }

  ngOnDestroy(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  @HostListener('window:focus')
  onWindowFocus(): void {
    // Khi Admin chuyển qua lại giữa các tab trình duyệt, tự động nạp đơn hàng mới
    this.load(true);
  }

  load(silent: boolean = false): void {
    if (!silent) {
      this.loading.set(true);
    }
    this.error.set('');
    const params: Record<string, string | number> = { page: this.page(), limit: this.limit };
    if (this.search())  params['search'] = this.search();
    if (this.status())  params['status'] = this.status();
    if (this.storeFilter()) params['warehouseId'] = this.storeFilter();

    this.orderApi.getAll(params).subscribe({
      next: (res) => {
        this.orders.set(res.data);
        this.total.set(res.total);
        if (res.statusCounts) {
          this.statusCounts.set(res.statusCounts);
        }
        this.selectedIds.set(new Set());
        const current = this.selected();
        const match = current ? res.data.find(x => x._id === current._id) : undefined;
        if (match) {
          this.selected.set(match);
          this.newStatus.set(match.status);
        } else if (res.data.length > 0) {
          this.selected.set(res.data[0]);
          this.newStatus.set(res.data[0].status);
        } else {
          this.selected.set(null);
          this.newStatus.set('');
        }
        if (!silent) {
          this.loading.set(false);
        }
      },
      error: (err) => {
        this.error.set(err.error?.message || 'Không thể tải đơn hàng.');
        if (!silent) {
          this.loading.set(false);
        }
      },
    });
  }

  onSearch(v: string): void { this.search.set(v); this.page.set(1); this.load(); }
  onStatus(v: string): void { this.qrOnlyFilter.set(false); this.status.set(v); this.page.set(1); this.load(); }
  toggleQrFilter(): void {
    const next = !this.qrOnlyFilter();
    this.qrOnlyFilter.set(next);
    if (next) {
      this.status.set('');
    }
  }
  filterPendingQr(): void {
    this.qrOnlyFilter.set(true);
    this.status.set('');
  }
  prevPage(): void { if (this.page() > 1)              { this.page.update(p => p - 1); this.load(); } }
  nextPage(): void { if (this.page() < this.totalPages()){ this.page.update(p => p + 1); this.load(); } }

  selectOrder(o: ApiOrder): void {
    this.selected.set(o);
    this.newStatus.set(o.status);
    this.error.set('');
  }

  openDetail(o: ApiOrder): void {
    this.selectOrder(o);
    this.detailOpen.set(true);
  }
  closeDetail(): void { this.detailOpen.set(false); }

  allowedStatusOptions(current: ApiOrder['status'], order?: ApiOrder | null): { value: string; label: string }[] {
    const o = order || this.selected();
    const allowed: ApiOrder['status'][] = [current];
    const isUnpaidQr = o && o.paymentMethod === 'bank_transfer' && o.paymentStatus !== 'paid';

    if (this.isWarehouse()) {
      if (!isUnpaidQr) {
        if (current === 'confirmed') allowed.push('preparing');
        if (current === 'preparing') allowed.push('shipping');
      }
      return this.statusOptions.filter(opt => allowed.includes(opt.value as ApiOrder['status']));
    }

    // Đơn VietQR chưa thanh toán: BẮT BUỘC duyệt QR trước, không cho nhảy sang bước tiếp theo
    if (!isUnpaidQr) {
      const next = this.nextStatusOf(current);
      if (next) allowed.push(next);
    }

    if (current !== 'delivered' && current !== 'cancelled') {
      allowed.push('cancelled');
    }
    return this.statusOptions.filter(opt => allowed.includes(opt.value as ApiOrder['status']));
  }

  updateStatus(): void {
    const o = this.selected();
    const target = this.newStatus() as ApiOrder['status'];
    if (!o || !target) return;
    const allowedValues = this.allowedStatusOptions(o.status).map(opt => opt.value);
    if (!allowedValues.includes(target) || target === o.status) return;
    this.updatingStatus.set(true);
    this.updatingOrderId.set(o._id);
    this.orderApi.updateStatus(o._id, target).subscribe({
      next: (res) => {
        this.updatingStatus.set(false);
        this.updatingOrderId.set(null);
        this.selected.set(res.data);
        this.newStatus.set(res.data.status);
        this.lastUpdatedOrderId.set(res.data._id);
        this.recentlyUpdatedIds.update(s => new Set(s).add(res.data._id));
        // Cập nhật số lượng đếm trên từng tab trạng thái ngay tại chỗ
        this.statusCounts.update(c => {
          const next = { ...c };
          if (next[o.status] !== undefined && next[o.status] > 0) next[o.status]--;
          if (next[target] !== undefined) next[target]++;
          return next;
        });
        // Cập nhật mượt mà trực tiếp trong danh sách tại chỗ (tuyệt đối không reload, không phá DOM, không giật trang)
        this.orders.update(list => list.map(it => it._id === res.data._id ? res.data : it));
        this.success.set(`Đã cập nhật đơn #${res.data.orderCode} sang "${this.statusLabel[res.data.status] || res.data.status}"`);
        setTimeout(() => this.success.set(''), 3500);
      },
      error: (err) => {
        this.updatingStatus.set(false);
        this.updatingOrderId.set(null);
        this.error.set(err.error?.message || 'Cập nhật thất bại.');
        setTimeout(() => this.error.set(''), 4000);
      },
    });
  }

  canConfirmQrPayment(o: ApiOrder): boolean {
    if (this.isWarehouse() || this.isSales()) return false;
    return (
      o.paymentMethod === 'bank_transfer' &&
      o.paymentStatus !== 'paid' &&
      o.paymentStatus !== 'expired' &&
      o.status === 'pending'
    );
  }

  confirmPayment(o: ApiOrder): void {
    if (!o || !this.canConfirmQrPayment(o) || this.confirmingPayment() || this.updatingOrderId()) return;
    this.confirmingPayment.set(true);
    this.updatingOrderId.set(o._id);
    this.error.set('');
    this.orderApi.confirmPayment(o._id, 'ADMIN_CONFIRMED').subscribe({
      next: (res) => {
        this.confirmingPayment.set(false);
        this.updatingOrderId.set(null);
        const updated = res.data || { ...o, paymentStatus: 'paid' as const };
        if (this.selected()?._id === o._id) {
          this.selected.set(updated);
          this.newStatus.set(updated.status);
        }
        this.lastUpdatedOrderId.set(o._id);
        this.recentlyUpdatedIds.update(s => new Set(s).add(o._id));
        // Cập nhật tại chỗ giữ nguyên vị trí dòng
        this.orders.update(list => list.map(it => it._id === o._id ? updated : it));
        this.success.set(`Đã xác nhận thanh toán VietQR cho đơn #${o.orderCode}!`);
        setTimeout(() => this.success.set(''), 3500);
      },
      error: (err) => {
        this.confirmingPayment.set(false);
        this.updatingOrderId.set(null);
        this.error.set(err.error?.message || 'Xác nhận thanh toán thất bại.');
        setTimeout(() => this.error.set(''), 4000);
      },
    });
  }

  getOrderSubtotal(o: ApiOrder): number {
    return o.items.reduce((s, it) => s + (it.priceNumber * it.quantity), 0);
  }

  formatPrice(v: number): string { return v.toLocaleString('vi-VN') + ' ₫'; }

  getComboItemName(it: any): string {
    return it?.product?.name || it?.name || 'Sản phẩm';
  }

  getComboItemQty(it: any): number {
    return Number(it?.quantity || 1);
  }

  getComboItemImage(it: any): string {
    return it?.product?.image || it?.image || '';
  }

  getComboItemPrice(it: any): string {
    if (it?.price) return String(it.price);
    if (it?.product?.price) return String(it.product.price);
    if (it?.priceNumber) return this.formatPrice(it.priceNumber);
    if (it?.product?.priceNumber) return this.formatPrice(it.product.priceNumber);
    return '';
  }

  customerInitials(o: ApiOrder): string {
    const name = (o.guestName || o.user?.name || 'KL').trim();
    const parts = name.split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  }

  statusStepIndex(status: ApiOrder['status']): number {
    const map: Record<string, number> = {
      pending: 0,
      confirmed: 1,
      preparing: 2,
      shipping: 3,
      delivered: 4,
      cancelled: -1,
    };
    return map[status] ?? 0;
  }

  nextStatusOf(status: ApiOrder['status']): ApiOrder['status'] | null {
    const flow: Record<string, ApiOrder['status']> = {
      pending: 'confirmed',
      confirmed: 'preparing',
      preparing: 'shipping',
      shipping: 'delivered',
    };
    return flow[status] ?? null;
  }

  nextActionLabel(status: ApiOrder['status']): string | null {
    if (this.isSales()) {
      // Sales phụ trách tiếp nhận & xác nhận đơn hàng khi khách đặt
      if (status === 'pending') return 'Xác nhận đơn';
      return null; // Các bước Chuẩn bị hàng, Bắt đầu giao thuộc về Bộ phận Kho & Vận chuyển!
    }
    if (this.isWarehouse()) {
      if (status === 'confirmed') return 'Chuẩn bị hàng';
      if (status === 'preparing') return 'Bắt đầu giao';
      return null;
    }
    const labels: Partial<Record<ApiOrder['status'], string>> = {
      pending: 'Xác nhận đơn',
      confirmed: 'Chuẩn bị hàng',
      preparing: 'Bắt đầu giao',
      shipping: 'Hoàn tất',
    };
    return labels[status] ?? null;
  }

  shortShipLabel(method: string): string {
    return method === 'pickup' ? 'Nhận tại quầy' : 'Giao tận nơi';
  }

  shortSlot(slot?: string): string {
    if (!slot) return '';
    const idx = slot.indexOf(':');
    const clean = idx >= 0 ? slot.slice(idx + 1).trim() : slot;
    return clean.replace(/^Từ\s+/i, '').replace(/\s+/g, ' ').trim();
  }

  quickAdvance(o: ApiOrder): void {
    const next = this.nextStatusOf(o.status);
    if (!next || this.updatingStatus() || this.updatingOrderId()) return;
    this.newStatus.set(next);
    this.selected.set(o);
    this.updateStatus();
  }

  activeFilterCount = computed(() =>
    (this.paymentFilter() ? 1 : 0) +
    (this.paymentStateFilter() ? 1 : 0) +
    (this.shippingFilter() ? 1 : 0)
  );

  dateRangeLabel = computed(() => {
    const map: Record<'all' | 'today' | '7d' | '30d', string> = {
      all: 'Tất cả thời gian',
      today: 'Hôm nay',
      '7d': '7 ngày qua',
      '30d': '30 ngày qua',
    };
    return map[this.dateRange()];
  });

  toggleMenu(menu: 'filter' | 'col' | 'date' | 'export'): void {
    this.filterMenuOpen.set(menu === 'filter' ? !this.filterMenuOpen() : false);
    this.colMenuOpen.set(menu === 'col' ? !this.colMenuOpen() : false);
    this.dateMenuOpen.set(menu === 'date' ? !this.dateMenuOpen() : false);
    this.exportMenuOpen.set(menu === 'export' ? !this.exportMenuOpen() : false);
  }

  closeMenus(): void {
    this.filterMenuOpen.set(false);
    this.colMenuOpen.set(false);
    this.dateMenuOpen.set(false);
    this.exportMenuOpen.set(false);
  }

  resetFilters(): void {
    this.paymentFilter.set('');
    this.paymentStateFilter.set('');
    this.shippingFilter.set('');
    this.dateRange.set('all');
  }

  toggleVisibleCol(col: 'shipping' | 'total' | 'status'): void {
    this.visibleCols.update(v => ({ ...v, [col]: !v[col] }));
  }

  sortedOrders = computed(() => {
    const pay = this.paymentFilter();
    const payState = this.paymentStateFilter();
    const ship = this.shippingFilter();
    const range = this.dateRange();
    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
    const minTime =
      range === 'today' ? startOfToday :
      range === '7d' ? now.getTime() - 7 * 86400000 :
      range === '30d' ? now.getTime() - 30 * 86400000 : 0;

    const list = this.orders().filter(o => {
      if (this.qrOnlyFilter() && !this.canConfirmQrPayment(o)) return false;
      // Tuân thủ nghiêm ngặt các bộ lọc thuộc tính người dùng đã chọn (Phương thức thanh toán, tình trạng tiền, hình thức nhận, thời gian)
      if (pay && o.paymentMethod !== pay) return false;
      if (payState && (o.paymentStatus || 'unpaid') !== payState) return false;
      if (ship && o.shippingMethod !== ship) return false;
      if (minTime && new Date(o.createdAt).getTime() < minTime) return false;
      return true;
    });
    const by = this.sortBy();
    const dir = this.sortDir() === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      if (by === 'total') return (a.total - b.total) * dir;
      if (by === 'customer') {
        const na = (a.guestName || a.user?.name || '').toLowerCase();
        const nb = (b.guestName || b.user?.name || '').toLowerCase();
        return na.localeCompare(nb, 'vi') * dir;
      }
      if (by === 'status') {
        const aUpdated = this.recentlyUpdatedIds().has(a._id);
        const bUpdated = this.recentlyUpdatedIds().has(b._id);
        if (aUpdated || bUpdated) {
          return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * -1;
        }
        return a.status.localeCompare(b.status) * dir;
      }
      return (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()) * dir;
    });
  });

  allSelected = computed(() => {
    const list = this.orders();
    return list.length > 0 && this.selectedIds().size === list.length;
  });

  toggleSelectAll(): void {
    const list = this.orders();
    if (this.allSelected()) {
      this.selectedIds.set(new Set());
    } else {
      this.selectedIds.set(new Set(list.map(o => o._id)));
    }
  }

  clearSelection(): void {
    this.selectedIds.set(new Set());
  }

  toggleSelect(id: string): void {
    this.selectedIds.update(set => {
      const next = new Set(set);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  toggleSort(col: 'date' | 'customer' | 'total' | 'status'): void {
    if (this.sortBy() === col) {
      this.sortDir.update(d => (d === 'asc' ? 'desc' : 'asc'));
    } else {
      this.sortBy.set(col);
      this.sortDir.set(col === 'customer' ? 'asc' : 'desc');
    }
  }

  toggleColMenu(): void {
    this.colMenuOpen.update(v => !v);
  }

  toggleCol(key: 'customer' | 'product' | 'shipping' | 'total' | 'status'): void {
    this.visibleCols.update(cols => ({ ...cols, [key]: !cols[key] }));
  }

  exportCsv(): void {
    const selected = this.selectedIds();
    const rows = selected.size > 0
      ? this.sortedOrders().filter(o => selected.has(o._id))
      : this.sortedOrders();
    if (rows.length === 0) return;

    const escape = (v: string | number) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const headers = ['Mã đơn', 'Ngày đặt', 'Khách hàng', 'Email', 'Sản phẩm', 'Hình thức', 'Tổng tiền (VND)', 'Trạng thái', 'Thanh toán'];
    const lines = rows.map(o => [
      `#${o.orderCode}`,
      new Date(o.createdAt).toLocaleString('vi-VN'),
      o.guestName || o.user?.name || '',
      o.guestEmail || o.user?.email || '',
      o.items?.[0]?.productName ? `${o.items[0].productName}${o.items.length > 1 ? ` (+${o.items.length - 1})` : ''}` : '',
      this.shippingLabel[o.shippingMethod] || o.shippingMethod,
      o.total,
      this.statusLabel[o.status] || o.status,
      o.paymentMethod === 'bank_transfer' ? (o.paymentStatus === 'paid' ? 'Đã TT VietQR' : 'VietQR') : 'COD',
    ].map(escape).join(','));

    const csv = '\uFEFF' + [headers.map(escape).join(','), ...lines].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `don-hang-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  exportExcel(): void {
    const currentStatus = this.status();
    const query = new URLSearchParams();
    if (currentStatus && currentStatus !== 'all') query.set('status', currentStatus);
    const token = localStorage.getItem('xanhla_admin_token') || localStorage.getItem('xanhla_auth_token') || '';
    if (token) query.set('token', token);

    // Kết nối trực tiếp đến backend API để lấy file nhị phân Excel thật
    const fullUrl = `${API_BASE}/orders/export/excel?${query.toString()}`;

    fetch(fullUrl, {
      method: 'GET',
      headers: {
        'Authorization': token ? `Bearer ${token}` : '',
      }
    })
    .then(async (res) => {
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      return res.blob();
    })
    .then((blob) => {
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `XanhLa_BaoCao_DonHang_${new Date().toISOString().slice(0, 10)}.xlsx`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
    })
    .catch((err) => {
      console.error('Lỗi tải file Excel:', err);
      // Fallback xuất CSV nếu máy chủ từ chối
      this.exportCsv();
    });
  }

  printOrderInvoice(ord: ApiOrder): void {
    const printWin = window.open('', '_blank', 'width=800,height=900');
    if (!printWin) {
      alert('Vui lòng cho phép popup để in phiếu đơn hàng.');
      return;
    }
    const fmtMoney = (v?: number) => (v || 0).toLocaleString('vi-VN') + ' ₫';
    const itemsHtml = (ord.items || []).map((it, idx) => `
      <tr>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:center">${idx + 1}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb">
          <strong>${it.productName}</strong>
          ${it.selectedOption ? `<div style="font-size:12px;color:#6b7280">${it.selectedOption}</div>` : ''}
          ${it.isCombo && it.comboItems?.length ? `<div style="font-size:11px;color:#059669">Combo: ${it.comboItems.map(c => c.name).join(', ')}</div>` : ''}
        </td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:center">${it.quantity}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right">${fmtMoney(it.priceNumber)}</td>
        <td style="padding:8px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:600">${fmtMoney((it.priceNumber || 0) * (it.quantity || 1))}</td>
      </tr>
    `).join('');

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>Phiếu Giao Hàng - #${ord.orderCode}</title>
        <style>
          @page { size: A4; margin: 15mm; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; color: #1f2937; margin: 0; padding: 20px; font-size: 13px; line-height: 1.5; }
          .header { display: flex; justify-content: space-between; border-bottom: 2px solid #166534; padding-bottom: 12px; margin-bottom: 16px; }
          .store-name { font-size: 20px; font-weight: 800; color: #166534; text-transform: uppercase; }
          .store-info { font-size: 12px; color: #4b5563; }
          .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; background: #f9fafb; padding: 12px; border-radius: 6px; margin-bottom: 16px; border: 1px solid #e5e7eb; }
          .info-block dt { font-weight: 600; color: #374151; font-size: 12px; }
          .info-block dd { margin: 0 0 6px 0; color: #111827; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 16px; }
          th { background: #f3f4f6; padding: 8px; text-align: left; font-size: 12px; border-bottom: 1px solid #d1d5db; }
          .totals { width: 320px; margin-left: auto; margin-bottom: 24px; }
          .totals-row { display: flex; justify-content: space-between; padding: 4px 0; }
          .totals-row.final { font-size: 15px; font-weight: 800; color: #166534; border-top: 1px solid #d1d5db; padding-top: 8px; }
          .signatures { display: grid; grid-template-columns: 1fr 1fr 1fr; text-align: center; margin-top: 40px; page-break-inside: avoid; }
          .sig-title { font-weight: 600; margin-bottom: 48px; }
          @media print {
            body { padding: 0; }
            .no-print { display: none; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <div>
            <div class="store-name">Evergreen Mart</div>
            <div class="store-info">Nông sản sạch VietGAP &amp; Thực phẩm hữu cơ</div>
            <div class="store-info">Hotline: 1900 8888 - www.evergreenmart.vn</div>
          </div>
          <div style="text-align:right">
            <div style="font-size:16px;font-weight:700">PHIẾU ĐÓNG GÓI &amp; GIAO HÀNG</div>
            <div style="font-size:12px;color:#6b7280">Mã đơn: <strong style="color:#111827">#${ord.orderCode}</strong></div>
            <div style="font-size:12px;color:#6b7280">Ngày đặt: ${new Date(ord.createdAt).toLocaleString('vi-VN')}</div>
          </div>
        </div>

        <div class="info-grid">
          <div class="info-block">
            <dt>Người nhận hàng:</dt>
            <dd><strong>${ord.guestName || ord.user?.name || 'Khách lẻ'}</strong></dd>
            <dt>Số điện thoại:</dt>
            <dd><strong>${ord.guestPhone || ''}</strong></dd>
            <dt>Hình thức nhận:</dt>
            <dd>${this.shippingLabel[ord.shippingMethod] || ord.shippingMethod}</dd>
          </div>
          <div class="info-block">
            <dt>Địa chỉ giao hàng:</dt>
            <dd>${ord.shippingAddress || (ord.pickupStore ? (ord.pickupStore.name || ord.pickupStore.address) : 'Nhận tại quầy')}</dd>
            <dt>Thanh toán:</dt>
            <dd>${ord.paymentMethod === 'bank_transfer' ? (ord.paymentStatus === 'paid' ? 'ĐÃ THANH TOÁN (VietQR)' : 'Chờ chuyển khoản VietQR') : 'Thu tiền tận nơi (COD)'}</dd>
            <dt>Ghi chú:</dt>
            <dd>${ord.note || 'Không có ghi chú'}</dd>
          </div>
        </div>

        <table>
          <thead>
            <tr>
              <th style="width:36px;text-align:center">STT</th>
              <th>Sản phẩm</th>
              <th style="width:60px;text-align:center">SL</th>
              <th style="width:100px;text-align:right">Đơn giá</th>
              <th style="width:110px;text-align:right">Thành tiền</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHtml}
          </tbody>
        </table>

        <div class="totals">
          <div class="totals-row">
            <span>Tiền hàng:</span>
            <span>${fmtMoney(ord.subtotal)}</span>
          </div>
          ${(ord.discount || 0) > 0 ? `
            <div class="totals-row" style="color:#dc2626">
              <span>Giảm giá:</span>
              <span>-${fmtMoney(ord.discount)}</span>
            </div>
          ` : ''}
          ${(ord.shippingFee || 0) > 0 ? `
            <div class="totals-row">
              <span>Phí vận chuyển:</span>
              <span>+${fmtMoney(ord.shippingFee)}</span>
            </div>
          ` : ''}
          <div class="totals-row final">
            <span>TỔNG CỘNG:</span>
            <span>${fmtMoney(ord.total)}</span>
          </div>
        </div>

        <div class="signatures">
          <div>
            <div class="sig-title">Người lập phiếu</div>
            <div>(Ký, ghi rõ họ tên)</div>
          </div>
          <div>
            <div class="sig-title">Người giao hàng</div>
            <div>(Ký, ghi rõ họ tên)</div>
          </div>
          <div>
            <div class="sig-title">Người nhận hàng</div>
            <div>(Ký, ghi rõ họ tên)</div>
          </div>
        </div>

        <script>
          window.onload = function() {
            window.print();
          };
        </script>
      </body>
      </html>
    `;
    printWin.document.write(html);
    printWin.document.close();
  }

  readonly kanbanStages: { key: ApiOrder['status']; label: string; tone: string }[] = [
    { key: 'pending', label: 'Chờ xử lý', tone: 'amber' },
    { key: 'confirmed', label: 'Đã xác nhận', tone: 'sky' },
    { key: 'preparing', label: 'Đang đóng gói', tone: 'violet' },
    { key: 'shipping', label: 'Đang giao lạnh', tone: 'emerald' },
    { key: 'delivered', label: 'Đã giao', tone: 'forest' },
    { key: 'cancelled', label: 'Đã hủy', tone: 'rose' },
  ];

  ordersForStage(stage: ApiOrder['status']): ApiOrder[] {
    return this.sortedOrders().filter(o => o.status === stage);
  }

  stageRevenue(stage: ApiOrder['status']): number {
    return this.ordersForStage(stage).reduce((s, o) => s + o.total, 0);
  }

  timelineGroups = computed(() => {
    const groups = new Map<string, { dateKey: string; label: string; totalAmount: number; items: ApiOrder[] }>();
    const todayStr = new Date().toLocaleDateString('vi-VN');
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayStr = yesterday.toLocaleDateString('vi-VN');

    for (const o of this.sortedOrders()) {
      const d = new Date(o.createdAt);
      const dateKey = d.toLocaleDateString('vi-VN');
      let label = dateKey;
      if (dateKey === todayStr) label = `Hôm nay - ${dateKey}`;
      else if (dateKey === yesterdayStr) label = `Hôm qua - ${dateKey}`;

      if (!groups.has(dateKey)) {
        groups.set(dateKey, { dateKey, label, totalAmount: 0, items: [] });
      }
      const g = groups.get(dateKey)!;
      if (o.status !== 'cancelled') g.totalAmount += o.total;
      g.items.push(o);
    }
    return Array.from(groups.values());
  });
}
