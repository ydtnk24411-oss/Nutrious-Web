import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  DashboardApiService,
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

  ngOnInit(): void {
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
    if (filter !== 'custom') {
      this.loadFinance();
    }
  }

  onCustomDateChange(type: 'start' | 'end', value: string): void {
    if (type === 'start') this.customStartDate.set(value);
    else this.customEndDate.set(value);
    if (this.customStartDate() && this.customEndDate()) {
      this.loadFinance();
    }
  }

  onStoreChange(storeName: string): void {
    this.selectedStore.set(storeName);
    this.loadFinance();
  }

  toggleStoreRow(store: StoreFinanceItem): void {
    const next = this.selectedStore() === store.storeName ? '' : store.storeName;
    this.onStoreChange(next);
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
