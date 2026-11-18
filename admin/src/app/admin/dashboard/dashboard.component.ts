import { Component, signal, computed, inject, OnInit } from '@angular/core';
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
  topLimit = signal<5 | 10>(5);
  insights    = signal<string[]>([]);
  loading     = signal(true);
  error       = signal('');

  // Time filter
  timeFilter = signal<'7d' | '30d' | '90d' | 'custom'>('30d');
  customStartDate = signal('');
  customEndDate = signal('');
  chartMode = signal<'revenue' | 'orders'>('revenue');
  selectedMetric = signal<'revenue' | 'orders' | 'profit' | 'aov'>('revenue');
  compareOrders = signal(true);

  // Store/Branch Filter for Admin & Chain Management
  selectedBranch = signal<string>('all');
  isManager = computed(() => (this.auth.user()?.role || '').toLowerCase() === 'manager');
  isSales = computed(() => (this.auth.user()?.role || '').toLowerCase() === 'sales');
  isMarketing = computed(() => (this.auth.user()?.role || '').toLowerCase() === 'marketing');
  userAssignedStore = computed(() => this.auth.user()?.assignedStore || '');

  readonly branchList = [
    { id: 'all', name: 'Toàn hệ thống (Tất cả chi nhánh)' },
    { id: 'store-thuduc', name: 'Tổng kho Evergreen Mart Thủ Đức' },
    { id: 'store-q1', name: 'Cửa hàng Evergreen Mart Quận 1' },
    { id: 'store-binhthanh', name: 'Cửa hàng Evergreen Mart Bình Thạnh' },
    { id: 'store-q7', name: 'Cửa hàng Evergreen Mart Quận 7' },
    { id: 'store-tanbinh', name: 'Cửa hàng Evergreen Mart Tân Bình' },
    { id: 'store-govap', name: 'Cửa hàng Evergreen Mart Gò Vấp' },
    { id: 'store-binhtan', name: 'Cửa hàng Evergreen Mart Bình Tân' },
    { id: 'store-dian', name: 'Kho Evergreen Mart Dĩ An' },
  ];

  get managerStoreDisplayName(): string {
    const raw = this.userAssignedStore();
    const id = (!raw || raw === 'all' || raw === 'ALL') ? 'store-q1' : raw;
    const found = this.branchList.find(b => b.id === id && b.id !== 'all');
    return found ? found.name : 'Cửa hàng Evergreen Mart Quận 1';
  }

  getBranchName(bId: string): string {
    if (this.isManager()) {
      return this.managerStoreDisplayName;
    }
    const found = this.branchList.find(b => b.id === bId);
    return found ? found.name : 'Chi nhánh phụ trách';
  }

  onBranchChange(bId: string): void {
    if (this.isManager()) return;
    this.selectedBranch.set(bId);
    this.loadData();
  }

  // Interactive chart hover states
  hoveredLineIndex = signal<number | null>(null);
  hoveredBarIndex = signal<number | null>(null);
  hoveredHistIndex = signal<number | null>(null);
  hoveredDonutStatus = signal<string | null>(null);
  selectedDonutStatus = signal<string | null>(null);
  hoveredFinSeg = signal<'cogs' | 'ops' | 'profit' | null>(null);

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
    if (this.isManager()) {
      const rawStore = this.userAssignedStore();
      const myStore = (!rawStore || rawStore === 'all' || rawStore === 'ALL') ? 'store-q1' : rawStore;
      this.selectedBranch.set(myStore);
    }
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    this.error.set('');

    const { startDate, endDate } = this.getDateRange();
    const store = this.selectedBranch() !== 'all' ? this.selectedBranch() : undefined;

    // Load all data in parallel
    Promise.all([
      this.dashApi.getStats(startDate, endDate, store).toPromise(),
      this.dashApi.getRevenue(startDate, endDate, store).toPromise(),
      this.dashApi.getRevenueByCategory(startDate, endDate, store).toPromise(),
      this.dashApi.getTopProducts(startDate, endDate, 10, store).toPromise(),
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

  get displayedTopProducts(): TopProduct[] {
    return this.topProducts().slice(0, this.topLimit());
  }

  setTopLimit(limit: 5 | 10): void {
    this.topLimit.set(limit);
  }

  barHeight(rev: number): number {
    const max = Math.max(...this.barData().map(b => b.revenue), 1);
    return Math.max(10, Math.round((rev / max) * 130));
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

  setChartMode(mode: 'revenue' | 'orders'): void {
    this.chartMode.set(mode);
  }

  selectMetric(metric: 'revenue' | 'orders' | 'profit' | 'aov'): void {
    this.selectedMetric.set(metric);
    this.chartMode.set(metric === 'orders' ? 'orders' : 'revenue');
  }

  toggleCompareOrders(): void {
    this.compareOrders.update(v => !v);
  }

  get maxOrderCount(): number {
    const data = this.lineData();
    if (data.length === 0) return 1;
    return Math.max(...data.map(d => d.count), 1);
  }

  orderLinePointY(count: number): number {
    const max = this.maxOrderCount;
    const h = 180;
    const padding = 20;
    return h - ((count / max) * (h - padding * 2)) - padding;
  }

  get orderOverlayLinePoints(): string {
    const data = this.lineData();
    if (data.length === 0) return '';
    if (data.length === 1) return `300,${this.orderLinePointY(data[0].count)}`;
    const step = 560 / (data.length - 1);
    return data.map((d, i) => `${(i * step) + 20},${this.orderLinePointY(d.count)}`).join(' ');
  }

  get rightYAxisTicks(): string[] {
    const max = this.maxOrderCount;
    return [String(max), String(Math.round(max / 2)), '0'];
  }

  get avgReferenceY(): number {
    if (this.chartMode() === 'orders') {
      const data = this.lineData();
      const avg = data.length ? data.reduce((s, d) => s + d.count, 0) / data.length : 0;
      return this.chartPointY(avg);
    }
    return this.chartPointY(this.avgDailyRevenue);
  }

  get deliveredCount(): number {
    return this.stats()?.ordersByStatus?.find(s => s._id === 'delivered')?.count ?? 0;
  }

  get cancelledCount(): number {
    return this.stats()?.ordersByStatus?.find(s => s._id === 'cancelled')?.count ?? 0;
  }

  formatCompact(v: number): string {
    if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(/\.0$/, '')}tr`;
    if (v >= 1_000) return `${Math.round(v / 1_000)}k`;
    return `${v}`;
  }

  get maxChartValue(): number {
    const data = this.lineData();
    if (data.length === 0) return 1;
    const mode = this.chartMode();
    return Math.max(...data.map(d => (mode === 'revenue' ? d.revenue : d.count)), 1);
  }

  chartPointY(val: number): number {
    const max = this.maxChartValue;
    const h = 180;
    const padding = 20;
    return h - ((val / max) * (h - padding * 2)) - padding;
  }

  get activeLinePoints(): string {
    const data = this.lineData();
    if (data.length === 0) return '';
    const mode = this.chartMode();
    const val = (d: LinePoint) => (mode === 'revenue' ? d.revenue : d.count);
    if (data.length === 1) return `300,${this.chartPointY(val(data[0]))}`;
    const step = 560 / (data.length - 1);
    return data.map((d, i) => `${(i * step) + 20},${this.chartPointY(val(d))}`).join(' ');
  }

  get activeLineAreaPoints(): string {
    const points = this.activeLinePoints;
    if (!points) return '';
    const data = this.lineData();
    const mode = this.chartMode();
    if (data.length === 1) {
      const y = this.chartPointY(mode === 'revenue' ? data[0].revenue : data[0].count);
      return `20,200 20,${y} 580,${y} 580,200`;
    }
    const lastX = ((data.length - 1) * (560 / (data.length - 1))) + 20;
    return `20,200 ${points} ${lastX},200`;
  }

  get yAxisTicks(): string[] {
    const max = this.maxChartValue;
    if (this.chartMode() === 'orders') {
      return [String(max), String(Math.round(max / 2)), '0'];
    }
    return [this.formatCompact(max), this.formatCompact(Math.round(max / 2)), '0đ'];
  }

  get peakLinePoint(): LinePoint | null {
    const data = this.lineData();
    if (data.length === 0) return null;
    return data.reduce((best, cur) => (cur.revenue > best.revenue ? cur : best), data[0]);
  }

  get avgDailyRevenue(): number {
    const data = this.lineData();
    if (data.length === 0) return 0;
    const total = data.reduce((sum, d) => sum + d.revenue, 0);
    return Math.round(total / data.length);
  }

  get totalLineOrders(): number {
    return this.lineData().reduce((sum, d) => sum + d.count, 0);
  }

  get recentOrderBars(): LinePoint[] {
    const data = this.lineData();
    return data.length > 14 ? data.slice(-14) : data;
  }

  orderBarHeight(count: number): number {
    const bars = this.recentOrderBars;
    const max = Math.max(...bars.map(b => b.count), 1);
    if (count === 0) return 4;
    return Math.max(12, Math.round((count / max) * 125));
  }

  get totalStatusOrders(): number {
    const s = this.stats();
    if (!s?.ordersByStatus) return 0;
    return s.ordersByStatus.reduce((sum, item) => sum + item.count, 0);
  }

  get completedOrdersCount(): number {
    return this.stats()?.ordersByStatus?.find(s => s._id === 'delivered')?.count ?? 0;
  }

  get completionRate(): number {
    const total = this.totalStatusOrders;
    if (total === 0) return 0;
    const delivered = this.stats()?.ordersByStatus?.find(s => s._id === 'delivered')?.count ?? 0;
    return Number(((delivered / total) * 100).toFixed(1));
  }

  get cancellationRate(): number {
    const total = this.totalStatusOrders;
    if (total === 0) return 0;
    const cancelled = this.stats()?.ordersByStatus?.find(s => s._id === 'cancelled')?.count ?? 0;
    return Number(((cancelled / total) * 100).toFixed(1));
  }

  get activePipelineCount(): number {
    const statuses = this.stats()?.ordersByStatus ?? [];
    const active = new Set(['pending', 'confirmed', 'preparing', 'shipping']);
    return statuses.filter(s => active.has(s._id)).reduce((sum, s) => sum + s.count, 0);
  }

  get categoryTotalRevenue(): number {
    return this.barData().reduce((sum, b) => sum + b.revenue, 0);
  }

  categoryShare(rev: number): string {
    const total = this.categoryTotalRevenue;
    if (total <= 0) return '0';
    return ((rev / total) * 100).toFixed(1);
  }

  get hoveredLinePoint(): LinePoint | null {
    const idx = this.hoveredLineIndex();
    if (idx === null) return null;
    return this.lineData()[idx] ?? null;
  }

  get hoveredLineLeftPct(): number {
    const idx = this.hoveredLineIndex();
    if (idx === null) return 50;
    return (this.linePointX(idx) / 600) * 100;
  }

  lineHitStartX(index: number): number {
    const data = this.lineData();
    if (data.length <= 1 || index === 0) return 0;
    const halfStep = 560 / (data.length - 1) / 2;
    return this.linePointX(index) - halfStep;
  }

  lineHitRectWidth(index: number): number {
    const data = this.lineData();
    if (data.length <= 1) return 600;
    const start = this.lineHitStartX(index);
    const halfStep = 560 / (data.length - 1) / 2;
    const end = index === data.length - 1 ? 600 : this.linePointX(index) + halfStep;
    return Math.max(1, end - start);
  }

  get activeDonutStatus(): string | null {
    return this.hoveredDonutStatus() ?? this.selectedDonutStatus();
  }

  toggleDonutStatus(status: string): void {
    this.selectedDonutStatus.update(cur => (cur === status ? null : status));
  }

  get hoveredDonutSegment() {
    const status = this.activeDonutStatus;
    if (!status) return null;
    return this.getDonutSegments().find(seg => seg.status === status) ?? null;
  }

  // Sparkline SVG helper for 4 KPI cards (Sale Performance Dashboard)
  getSparkline(metric: 'revenue' | 'orders' | 'aov' | 'users'): { points: string; areaPoints: string } {
    const raw = this.lineData();
    let values: number[] = [];
    if (raw && raw.length >= 3) {
      if (metric === 'revenue') values = raw.map(d => d.revenue);
      else if (metric === 'orders') values = raw.map(d => d.count);
      else if (metric === 'aov') values = raw.map(d => d.count > 0 ? d.revenue / d.count : 0);
      else values = raw.map((d, i) => (i + 1) * 3 + d.count);
    } else {
      const s = this.stats();
      const base = metric === 'revenue' ? (s?.totalRevenue || 127000) : (metric === 'orders' ? (s?.totalOrders || 2) : 63500);
      values = [base * 0.72, base * 0.88, base * 0.81, base * 0.94, base * 0.89, base * 1.04, base];
    }

    const min = Math.min(...values);
    const max = Math.max(...values, min + 1);
    const w = 110;
    const h = 34;
    const pad = 3;

    const coords = values.map((v, i) => {
      const x = Math.round((i / (values.length - 1)) * w);
      const y = Math.round(h - pad - ((v - min) / (max - min)) * (h - pad * 2));
      return `${x},${y}`;
    });

    const points = coords.join(' ');
    const areaPoints = `0,${h} ${points} ${w},${h}`;
    return { points, areaPoints };
  }

  // Market Heatmap / Treemap for Categories & SKUs (Inspired by Stock/Market Visuals)
  get categoryHeatmap() {
    const categories = this.barData();
    const totalRev = categories.reduce((sum, c) => sum + (c.revenue || 0), 0) || (this.stats()?.totalRevenue || 1);

    const codeMap: Record<string, string> = {
      'Rau củ': 'RAU-CU',
      'Trái cây': 'TRAI-CAY',
      'Thịt, cá & hải sản': 'THIT-CA',
      'Trứng & Sữa tươi': 'SUA-TRUNG',
      'Gạo & Nông sản khô': 'DO-KHO',
      'Bánh & Đồ ăn vặt': 'AN-VAT',
      'Gia vị & Chế biến': 'GIA-VI',
      'Đồ uống hữu cơ': 'DO-UONG'
    };

    return categories.map((cat, idx) => {
      const share = totalRev > 0 ? Math.round((cat.revenue / totalRev) * 100) : 10;
      const code = codeMap[cat.label] || `CAT-0${idx + 1}`;
      const growthPct = idx % 2 === 0 ? +(5.2 + idx * 1.4).toFixed(1) : +(2.8 + idx * 0.9).toFixed(1);
      return {
        ...cat,
        code,
        share: Math.max(share, 6),
        growthPct,
        margin: idx % 3 === 0 ? 32 : (idx % 2 === 0 ? 28 : 24)
      };
    });
  }
}
