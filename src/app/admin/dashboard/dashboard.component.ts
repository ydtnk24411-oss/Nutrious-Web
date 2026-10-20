import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DashboardApiService, DashboardStats, TopProduct, RevenueData, CategoryRevenue } from '../../shared/services/dashboard-api.service';
import { AdminAuthService } from '../../shared/services/admin-auth.service';

export interface LinePoint { date: string; revenue: number; count: number; }

@Component({
  selector: 'app-admin-dashboard',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.css',
})
export class AdminDashboardComponent implements OnInit {
  private dashApi = inject(DashboardApiService);
  protected auth = inject(AdminAuthService);

  stats       = signal<DashboardStats | null>(null);
  barData     = signal<CategoryRevenue[]>([]);
  lineData    = signal<LinePoint[]>([]);
  topProducts = signal<TopProduct[]>([]);
  insights    = signal<string[]>([]);
  loading     = signal(true);
  error       = signal('');

  // Time filter
  timeFilter = signal<'7d' | '30d' | '90d' | 'custom'>('30d');
  customStartDate = signal('');
  customEndDate = signal('');

  readonly orderStatusMap: Record<string, string> = {
    pending:   'Chờ xử lý',
    confirmed: 'Đã xác nhận',
    preparing: 'Đang chuẩn bị',
    shipping:  'Đang giao',
    delivered: 'Đã giao',
    cancelled: 'Đã hủy',
  };

  readonly kpiCards = [
    {
      key: 'totalRevenue',
      label: 'Tổng doanh thu',
      svgIcon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 0 0-7H7"/></svg>',
      bgColor: 'linear-gradient(135deg, #d1fae5 0%, #a7f3d0 100%)',
      isCurrency: true
    },
    {
      key: 'totalOrders',
      label: 'Tổng đơn hàng',
      svgIcon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>',
      bgColor: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
      isCurrency: false
    },
    {
      key: 'averageOrderValue',
      label: 'Giá trị đơn TB',
      svgIcon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
      bgColor: 'linear-gradient(135deg, #fef3c7 0%, #fde68a 100%)',
      isCurrency: true
    },
    {
      key: 'totalUsers',
      label: 'Khách hàng mua hàng',
      svgIcon: '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
      bgColor: 'linear-gradient(135deg, #fce7f3 0%, #fbcfe8 100%)',
      isCurrency: false
    },
  ];

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    this.error.set('');

    const { startDate, endDate } = this.getDateRange();

    // Load all data in parallel
    Promise.all([
      this.dashApi.getStats(startDate, endDate).toPromise(),
      this.dashApi.getRevenue(startDate, endDate).toPromise(),
      this.dashApi.getRevenueByCategory(startDate, endDate).toPromise(),
      this.dashApi.getTopProducts(startDate, endDate, 10).toPromise(),
    ]).then(([statsRes, revenueRes, categoryRes, topRes]) => {
      if (statsRes) this.stats.set(statsRes.data);
      if (revenueRes) this.lineData.set(revenueRes.data);
      if (categoryRes) this.barData.set(categoryRes.data);
      if (topRes) this.topProducts.set(topRes.data);
      if (statsRes) this.insights.set(this.generateInsights(statsRes.data));
      this.loading.set(false);
    }).catch((err) => {
      this.error.set('Không thể tải dữ liệu dashboard.');
      this.loading.set(false);
    });
  }

  onTimeFilterChange(filter: '7d' | '30d' | '90d' | 'custom'): void {
    this.timeFilter.set(filter);
    this.loadData();
  }

  onCustomDateChange(field: 'start' | 'end', value: string): void {
    if (field === 'start') {
      this.customStartDate.set(value);
    } else {
      this.customEndDate.set(value);
    }
    if (this.customStartDate() && this.customEndDate()) {
      this.loadData();
    }
  }

  getDateRange(): { startDate: string; endDate: string } {
    const now = new Date();
    const end = now.toISOString().split('T')[0];
    let start: string;

    switch (this.timeFilter()) {
      case '7d':
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        start = sevenDaysAgo.toISOString().split('T')[0];
        break;
      case '30d':
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        start = thirtyDaysAgo.toISOString().split('T')[0];
        break;
      case '90d':
        const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        start = ninetyDaysAgo.toISOString().split('T')[0];
        break;
      case 'custom':
        start = this.customStartDate();
        break;
      default:
        const defaultDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        start = defaultDaysAgo.toISOString().split('T')[0];
    }

    return { startDate: start, endDate: end };
  }

  statValue(key: string): number {
    const s = this.stats();
    if (!s) return 0;
    return (s as unknown as Record<string, number>)[key] ?? 0;
  }

  formatBig(val: number): string {
    if (val >= 1_000_000) return (val / 1_000_000).toFixed(1) + 'M';
    if (val >= 1_000)     return (val / 1_000).toFixed(1) + 'K';
    return val.toString();
  }

  formatPrice(val: number): string {
    return val.toLocaleString('vi-VN') + ' ₫';
  }

  // Tính chiều cao bar theo tỉ lệ (max = 160px)
  barHeight(revenue: number): number {
    const vals = this.barData().map(b => b.revenue);
    const max  = Math.max(...vals, 1);
    return Math.max(Math.round((revenue / max) * 140), 4);
  }

  // Alternating highlight: bar chẵn (index 1, 3, ...) màu nhạt
  isHighlight(index: number): boolean {
    return index % 2 === 1;
  }

  // SVG polyline points cho line chart
  get linePoints(): string {
    const data = this.lineData();
    if (data.length < 2) return '';
    const W = 560, H = 160;
    const maxV = Math.max(...data.map(d => d.revenue), 1);
    return data.map((d, i) => {
      const x = (i / (data.length - 1)) * (W - 40) + 20;
      const y = d.revenue === 0
        ? H / 2
        : H - (d.revenue / maxV) * (H - 40) - 20;
      return `${x},${y}`;
    }).join(' ');
  }

  // SVG polygon points cho area under line
  get lineAreaPoints(): string {
    const data = this.lineData();
    if (data.length < 2) return '';
    const W = 560, H = 160;
    const maxV = Math.max(...data.map(d => d.revenue), 1);
    const points = data.map((d, i) => {
      const x = (i / (data.length - 1)) * (W - 40) + 20;
      const y = d.revenue === 0
        ? H / 2
        : H - (d.revenue / maxV) * (H - 40) - 20;
      return `${x},${y}`;
    }).join(' ');
    return `${points} ${W},${H} 20,${H}`;
  }

  // Tính toán vị trí y cho từng điểm trong line chart
  linePointY(revenue: number): number {
    const data = this.lineData();
    const H = 160;
    const maxV = Math.max(...data.map(d => d.revenue), 1);
    return revenue === 0 ? 80 : (H - (revenue / maxV) * (H - 40) - 20);
  }

  // Sale insights - generate based on actual data
  generateInsights(stats: DashboardStats | null): string[] {
    const insights: string[] = [];
    if (!stats) return insights;

    const deliveredOrders = stats.ordersByStatus.find(o => o._id === 'delivered')?.count || 0;
    const totalOrders = stats.totalOrders;
    const completionRate = totalOrders > 0 ? (deliveredOrders / totalOrders * 100) : 0;

    if (completionRate > 80) {
      insights.push(`Tỷ lệ đơn hoàn thành cao (${completionRate.toFixed(1)}%) - quy trình vận hành ổn định.`);
    } else if (completionRate < 50) {
      insights.push(`Tỷ lệ đơn hoàn thành thấp (${completionRate.toFixed(1)}%) - cần xem xét các đơn đang xử lý.`);
    }

    if (stats.averageOrderValue > 100000) {
      insights.push(`Giá trị đơn hàng trung bình khá cao (${this.formatPrice(stats.averageOrderValue)}) - khách hàng mua nhiều mỗi đơn.`);
    } else if (stats.averageOrderValue < 50000) {
      insights.push(`Giá trị đơn hàng trung bình thấp (${this.formatPrice(stats.averageOrderValue)}) - có thể khuyến mã upsell.`);
    }

    return insights;
  }

  // Order status breakdown for donut chart - convert to method
  getOrderStatusBreakdown() {
    const s = this.stats();
    if (!s || !s.ordersByStatus) return [];

    const total = s.ordersByStatus.reduce((sum: number, item: any) => sum + item.count, 0);
    const colors: Record<string, string> = {
      pending: '#f59e0b',
      confirmed: '#3b82f6',
      preparing: '#8b5cf6',
      shipping: '#06b6d4',
      delivered: '#059669',
      cancelled: '#ef4444',
    };

    return s.ordersByStatus.map((item: any) => ({
      status: item._id,
      label: this.orderStatusMap[item._id] || item._id,
      count: item.count,
      percentage: total > 0 ? ((item.count / total) * 100).toFixed(1) : '0',
      color: colors[item._id] || '#6b7280',
    }));
  }

  // Calculate donut chart segments - convert to method
  getDonutSegments() {
    const breakdown = this.getOrderStatusBreakdown();
    const total = breakdown.reduce((sum: number, item: any) => sum + item.count, 0);
    let cumulativeOffset = 0;
    const circumference = 440; // 2 * PI * 70

    return breakdown.map((item: any) => {
      const percentage = total > 0 ? item.count / total : 0;
      const dashArray = circumference * percentage;
      const segment = {
        ...item,
        dashArray,
        dashOffset: cumulativeOffset,
      };
      cumulativeOffset += dashArray;
      return segment;
    });
}
  hasOrderStatusData(): boolean {
    const s = this.stats();
    return !!(s && s.ordersByStatus && s.ordersByStatus.length > 0);
  }
}
