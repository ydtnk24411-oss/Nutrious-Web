import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminAuthService } from '../../shared/services/admin-auth.service';
import {
  DashboardApiService,
  FinanceDailyTrend,
  FinanceReportData,
  FinanceTransaction,
  StoreFinanceItem,
} from '../../shared/services/dashboard-api.service';

@Component({
  selector: 'app-admin-finance',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './finance.component.html',
  styleUrl: './finance.component.css',
})
export class AdminFinanceComponent implements OnInit {
  private dashApi = inject(DashboardApiService);
  protected auth    = inject(AdminAuthService);

  isManager = computed(() => (this.auth.user()?.role || '').toLowerCase() === 'manager');
  isAdmin   = computed(() => (this.auth.user()?.role || '').toLowerCase() === 'admin');

  managerStoreName = computed(() => {
    const u = this.auth.user();
    if (u?.storeName && !u.storeName.includes('Toàn hệ thống') && !u.storeName.includes('Tất cả')) {
      return u.storeName;
    }
    return 'Cửa hàng Evergreen Mart Quận 1';
  });

  report = signal<FinanceReportData | null>(null);
  loading = signal(true);
  error = signal('');

  // Filters
  timeFilter = signal<'7d' | '30d' | '90d' | 'custom'>('30d');
  customStartDate = signal('');
  customEndDate = signal('');
  selectedStore = signal<string>('');
  txFilter = signal<'all' | 'collected' | 'pending' | 'cancelled'>('all');
  txSearch = signal('');

  // Pagination for Financial Ledger
  page = signal(1);
  pageSize = signal(10);

  ngOnInit(): void {
    if (this.isManager()) {
      this.selectedStore.set(this.managerStoreName());
    }
    this.loadFinance();
  }

  getDateRange(): { startDate?: string; endDate?: string } {
    const filter = this.timeFilter();
    if (filter === 'custom') {
      return {
        startDate: this.customStartDate(),
        endDate: this.customEndDate(),
      };
    }

    const end = new Date();
    const start = new Date();
    if (filter === '7d') start.setDate(end.getDate() - 7);
    else if (filter === '30d') start.setDate(end.getDate() - 30);
    else if (filter === '90d') start.setDate(end.getDate() - 90);

    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0],
    };
  }

  loadFinance(): void {
    this.loading.set(true);
    this.error.set('');
    const { startDate, endDate } = this.getDateRange();
    const store = this.selectedStore() || undefined;

    this.dashApi.getFinance(startDate, endDate, store).subscribe({
      next: (res) => {
        this.report.set(res.data);
        this.loading.set(false);
      },
      error: (err) => {
        const msg = err?.error?.message;
        if (msg) {
          this.error.set(msg);
        } else if (err?.status === 404 || String(err?.message || '').includes('<!DOCTYPE')) {
          this.error.set('API /api/dashboard/finance chưa được nạp. Vui lòng khởi động lại server backend (service/) rồi tải lại trang.');
        } else {
          this.error.set('Không thể tải báo cáo tài chính.');
        }
        this.loading.set(false);
      },
    });
  }

  onTimeFilterChange(filter: '7d' | '30d' | '90d' | 'custom'): void {
    this.timeFilter.set(filter);
    this.page.set(1);
    if (filter !== 'custom') {
      this.loadFinance();
    }
  }

  onCustomDateChange(type: 'start' | 'end', value: string): void {
    if (type === 'start') this.customStartDate.set(value);
    else this.customEndDate.set(value);
    this.page.set(1);
    if (this.customStartDate() && this.customEndDate()) {
      this.loadFinance();
    }
  }

  onStoreChange(storeName: string): void {
    if (this.isManager()) return;
    this.selectedStore.set(storeName);
    this.page.set(1);
    this.loadFinance();
  }

  toggleStoreRow(store: StoreFinanceItem): void {
    const next = this.selectedStore() === store.storeName ? '' : store.storeName;
    this.onStoreChange(next);
  }

  onTxFilterChange(mode: 'all' | 'collected' | 'pending' | 'cancelled'): void {
    this.txFilter.set(mode);
    this.page.set(1);
  }

  onTxSearchChange(val: string): void {
    this.txSearch.set(val);
    this.page.set(1);
  }

  filteredTransactions = computed<FinanceTransaction[]>(() => {
    const txs = this.report()?.transactions ?? [];
    const mode = this.txFilter();
    const q = this.txSearch().trim().toLowerCase();

    return txs.filter((tx) => {
      if (mode === 'collected' && !tx.isCollected) return false;
      if (mode === 'pending' && (tx.isCollected || tx.status === 'cancelled')) return false;
      if (mode === 'cancelled' && tx.status !== 'cancelled') return false;
      if (q) {
        const hay = `${tx.orderCode} ${tx.customer} ${tx.storeName}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  });

  totalPages = computed<number>(() => {
    const total = this.filteredTransactions().length;
    return Math.max(1, Math.ceil(total / this.pageSize()));
  });

  pagedTransactions = computed<FinanceTransaction[]>(() => {
    const all = this.filteredTransactions();
    const p = this.page();
    const sz = this.pageSize();
    const start = (p - 1) * sz;
    return all.slice(start, start + sz);
  });

  ledgerTotals = computed(() => {
    const all = this.filteredTransactions();
    let subtotal = 0;
    let discount = 0;
    let shipping = 0;
    let total = 0;
    let profit = 0;
    for (const tx of all) {
      if (tx.status !== 'cancelled') {
        subtotal += tx.subtotal || 0;
        discount += tx.totalDiscount || 0;
        shipping += tx.shippingFee || 0;
        total += tx.total || 0;
        profit += tx.estimatedProfit || 0;
      }
    }
    return {
      count: all.length,
      subtotal,
      discount,
      shipping,
      total,
      profit,
    };
  });

  setPage(p: number): void {
    if (p >= 1 && p <= this.totalPages()) {
      this.page.set(p);
    }
  }

  setPageSize(sz: number): void {
    this.pageSize.set(Number(sz) || 10);
    this.page.set(1);
  }

  mathMin = Math.min;

  // ── Financial Daily Trend Chart Computeds & Helpers ───────────────
  hoveredTrendIndex = signal<number | null>(null);

  trendData = computed<FinanceDailyTrend[]>(() => {
    return this.report()?.dailyTrends ?? [];
  });

  maxTrendVal = computed<number>(() => {
    const list = this.trendData();
    if (list.length === 0) return 100000;
    const maxRev = Math.max(...list.map((d) => d.netRevenue || 0));
    return Math.max(100000, Math.round(maxRev * 1.15));
  });

  trendYAxisTicks = computed<string[]>(() => {
    const max = this.maxTrendVal();
    const formatTick = (val: number) => {
      if (val >= 1000000) return (val / 1000000).toFixed(1).replace('.0', '') + 'Tr';
      if (val >= 1000) return Math.round(val / 1000) + 'k';
      return String(val);
    };
    return [formatTick(max), formatTick(Math.round(max * 0.5)), '0đ'];
  });

  trendPointX(index: number): number {
    const total = this.trendData().length;
    if (total <= 1) return 300;
    return Math.round((index / (total - 1)) * 580) + 10;
  }

  trendPointRevY(pt: FinanceDailyTrend): number {
    const max = this.maxTrendVal();
    const r = Math.max(0, pt.netRevenue || 0);
    return Math.round(150 - (r / max) * 125);
  }

  trendPointProfY(pt: FinanceDailyTrend): number {
    const max = this.maxTrendVal();
    const p = Math.max(0, pt.estimatedProfit || 0);
    return Math.round(150 - (p / max) * 125);
  }

  trendHoverHitX(index: number): number {
    const total = this.trendData().length;
    if (total <= 1) return 0;
    const w = 600 / total;
    return Math.max(0, this.trendPointX(index) - w / 2);
  }

  trendHoverHitW(): number {
    const total = this.trendData().length;
    return total > 0 ? 600 / total : 600;
  }

  trendPoints = computed(() => {
    const list = this.trendData();
    if (list.length === 0) return { lineRev: '', lineProf: '', areaRev: '' };
    const revPts = list.map((pt, i) => `${this.trendPointX(i)},${this.trendPointRevY(pt)}`).join(' ');
    const profPts = list.map((pt, i) => `${this.trendPointX(i)},${this.trendPointProfY(pt)}`).join(' ');
    const firstX = this.trendPointX(0);
    const lastX = this.trendPointX(list.length - 1);
    const area = `${firstX},150 ${revPts} ${lastX},150`;
    return { lineRev: revPts, lineProf: profPts, areaRev: area };
  });

  hoveredTrendPoint = computed(() => {
    const idx = this.hoveredTrendIndex();
    if (idx === null) return null;
    const list = this.trendData();
    const pt = list[idx];
    if (!pt) return null;
    const margin = pt.netRevenue > 0 ? ((pt.estimatedProfit / pt.netRevenue) * 100).toFixed(1) : '0';
    return { ...pt, margin };
  });

  trendXAxisLabels = computed<string[]>(() => {
    const list = this.trendData();
    if (list.length === 0) return [];
    if (list.length <= 8) {
      return list.map((d) => {
        const parts = d.date.split('-');
        return parts.length >= 3 ? `${parts[2]}/${parts[1]}` : d.date;
      });
    }
    const step = Math.ceil(list.length / 6);
    const labels: string[] = [];
    for (let i = 0; i < list.length; i += step) {
      const parts = list[i].date.split('-');
      labels.push(parts.length >= 3 ? `${parts[2]}/${parts[1]}` : list[i].date);
    }
    return labels;
  });

  formatPrice(v: number): string {
    return (v ?? 0).toLocaleString('vi-VN') + 'đ';
  }

  pct(part: number, total: number): string {
    if (!total || total <= 0) return '0';
    return ((part / total) * 100).toFixed(1);
  }

  exportFinanceCsv(): void {
    const r = this.report();
    if (!r) return;

    const escape = (v: string | number) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const storeHeaders = [
      'Cửa hàng / Chi nhánh',
      'Đơn hợp lệ',
      'Đơn hủy',
      'Doanh thu gộp',
      'Tổng giảm giá',
      'Phí ship thu',
      'Doanh thu thuần',
      'Đã thu thực tế',
      'Chờ thu / Công nợ',
      'Giá vốn (64%)',
      'Vận hành (8%)',
      'LN gộp ước tính',
      'Biên LN (%)',
      'AOV',
    ];

    const storeRows = r.stores.map((s) =>
      [
        s.storeName,
        s.orderCount,
        s.cancelledCount,
        s.grossRevenue,
        s.totalDiscount,
        s.shippingRevenue,
        s.netRevenue,
        s.collectedAmount,
        s.pendingAmount,
        s.estimatedCogs,
        s.estimatedOps,
        s.estimatedProfit,
        `${s.profitMargin}%`,
        s.avgOrderValue,
      ]
        .map(escape)
        .join(',')
    );

    const csv = '\uFEFF' + [storeHeaders.map(escape).join(','), ...storeRows].join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bao-cao-tai-chinh-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }
}
