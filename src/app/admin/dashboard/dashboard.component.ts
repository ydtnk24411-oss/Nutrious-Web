import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { DashboardApiService, DashboardStats, CategoryRevenue, TopProduct } from '../../shared/services/dashboard-api.service';
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
  protected auth  = inject(AdminAuthService);

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
      svgIcon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 0 0-7H7"/></svg>',
      bgColor: '#eaf4e8',
      color: '#176b3a',
      isCurrency: true
    },
    {
      key: 'totalOrders',
      label: 'Đơn hàng hoàn tất',
      svgIcon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z"/><line x1="3" y1="6" x2="21" y2="6"/><path d="M16 10a4 4 0 0 1-8 0"/></svg>',
      bgColor: '#f1faea',
      color: '#5ca32a',
      isCurrency: false
    },
    {
      key: 'averageOrderValue',
      label: 'Giá trị trung bình đơn',
      svgIcon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>',
      bgColor: '#fff8e6',
      color: '#d97706',
      isCurrency: true
    },
    {
      key: 'totalUsers',
      label: 'Khách hàng thân thiết',
      svgIcon: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
      bgColor: '#e0f2fe',
      color: '#0284c7',
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
    if (filter !== 'custom') {
      this.loadData();
    }
  }

  onCustomDateChange(type: 'start' | 'end', value: string): void {
    if (type === 'start') {
      this.customStartDate.set(value);
    } else {
      this.customEndDate.set(value);
    }

    if (this.customStartDate() && this.customEndDate()) {
      this.loadData();
    }
  }

  getDateRange(): { startDate?: string; endDate?: string } {
    const filter = this.timeFilter();
    if (filter === 'custom') {
      return {
        startDate: this.customStartDate(),
        endDate: this.customEndDate()
      };
    }

    const end = new Date();
    const start = new Date();

    if (filter === '7d') {
      start.setDate(end.getDate() - 7);
    } else if (filter === '30d') {
      start.setDate(end.getDate() - 30);
    } else if (filter === '90d') {
      start.setDate(end.getDate() - 90);
    }

    return {
      startDate: start.toISOString().split('T')[0],
      endDate: end.toISOString().split('T')[0]
    };
  }

  statValue(key: string): number {
    const s = this.stats();
    if (!s) return 0;
    return (s as any)[key] ?? 0;
  }

  formatPrice(v: number): string {
    return v.toLocaleString('vi-VN') + 'đ';
  }

  barHeight(rev: number): number {
    const max = Math.max(...this.barData().map(b => b.revenue), 1);
    return Math.max(12, Math.round((rev / max) * 160));
  }

  isHighlight(index: number): boolean {
    return index === 0;
  }

  // Line chart helpers
  get maxRevenue(): number {
    const data = this.lineData();
    if (data.length === 0) return 1;
    return Math.max(...data.map(d => d.revenue), 1);
  }

  linePointY(rev: number): number {
    const max = this.maxRevenue;
    const h = 180;
    const padding = 20;
    return h - ((rev / max) * (h - padding * 2)) - padding;
  }

  linePointX(index: number): number {
    const data = this.lineData();
    if (data.length <= 1) return 300;
    return (index / (data.length - 1)) * 560 + 20;
  }

  get linePoints(): string {
    const data = this.lineData();
    if (data.length === 0) return '';
    if (data.length === 1) return `300,${this.linePointY(data[0].revenue)}`;
    const step = 560 / (data.length - 1);
    return data.map((d, i) => `${(i * step) + 20},${this.linePointY(d.revenue)}`).join(' ');
  }

  get lineAreaPoints(): string {
    const points = this.linePoints;
    if (!points) return '';
    const data = this.lineData();
    if (data.length === 1) {
      const y = this.linePointY(data[0].revenue);
      return `20,200 20,${y} 580,${y} 580,200`;
    }
    const lastX = ((data.length - 1) * (560 / (data.length - 1))) + 20;
    return `20,200 ${points} ${lastX},200`;
  }

  get visibleLabels(): LinePoint[] {
    const data = this.lineData();
    if (data.length <= 7) return data;
    const count = 6;
    const step = (data.length - 1) / (count - 1);
    const result: LinePoint[] = [];
    for (let i = 0; i < count; i++) {
      const idx = Math.min(Math.round(i * step), data.length - 1);
      result.push(data[idx]);
    }
    return result;
  }

  generateInsights(stats: DashboardStats): string[] {
    const insights: string[] = [];

    const deliveredOrders = stats.ordersByStatus?.find(s => s._id === 'delivered')?.count ?? 0;
    const totalOrders = stats.totalOrders;
    const completionRate = totalOrders > 0 ? (deliveredOrders / totalOrders * 100) : 0;

    if (completionRate > 80) {
      insights.push(`Tỷ lệ đơn hoàn thành xuất sắc (${completionRate.toFixed(1)}%) - quy trình vận hành và giao hàng xe lạnh ổn định.`);
    } else if (completionRate < 50) {
      insights.push(`Tỷ lệ đơn hoàn thành đạt ${completionRate.toFixed(1)}% - đề xuất kiểm tra các đơn hàng đang chuẩn bị hoặc đang giao.`);
    }

    if (stats.averageOrderValue > 100000) {
      insights.push(`Giá trị đơn hàng trung bình đạt mức cao (${this.formatPrice(stats.averageOrderValue)}) - người tiêu dùng có xu hướng mua trọn gói giỏ hàng tươi.`);
    } else if (stats.averageOrderValue < 50000) {
      insights.push(`Giá trị đơn hàng trung bình đạt ${this.formatPrice(stats.averageOrderValue)} - có thể bổ sung combo ưu đãi để kích thích quy mô đơn hàng.`);
    }

    insights.push(`Hệ sinh thái Evergreen Mart đang duy trì ${stats.totalUsers} khách hàng mua sắm thường xuyên với danh mục nông sản tươi sạch đa dạng.`);

    return insights;
  }

  // Order status breakdown for donut chart
  getOrderStatusBreakdown() {
    const s = this.stats();
    if (!s || !s.ordersByStatus) return [];

    const total = s.ordersByStatus.reduce((sum: number, item: any) => sum + item.count, 0);
    const colors: Record<string, string> = {
      pending: '#f59e0b',
      confirmed: '#0284c7',
      preparing: '#8b5cf6',
      shipping: '#059669',
      delivered: '#176b3a',
      cancelled: '#dc2626',
    };

    return s.ordersByStatus.map((item: any) => ({
      status: item._id,
      label: this.orderStatusMap[item._id] || item._id,
      count: item.count,
      percentage: total > 0 ? ((item.count / total) * 100).toFixed(1) : '0',
      color: colors[item._id] || '#6b7280',
    }));
  }

  // Calculate donut chart segments
  getDonutSegments() {
    const breakdown = this.getOrderStatusBreakdown();
    const total = breakdown.reduce((sum: number, item: any) => sum + item.count, 0);
    let cumulativeOffset = 0;
    const circumference = 440; // 2 * PI * 70

    return breakdown.map((item: any) => {
      const percentage = total > 0 ? item.count / total : 0;
      const dashLength = circumference * percentage;
      const segment = {
        ...item,
        dashArray: `${dashLength} ${circumference}`,
        dashOffset: -cumulativeOffset,
      };
      cumulativeOffset += dashLength;
      return segment;
    });
  }

  hasOrderStatusData(): boolean {
    const s = this.stats();
    return !!(s && s.ordersByStatus && s.ordersByStatus.length > 0);
  }
}
