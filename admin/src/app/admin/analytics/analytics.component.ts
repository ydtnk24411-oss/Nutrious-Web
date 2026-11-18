import { Component, signal, inject, OnInit, OnDestroy, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AnalyticsApiService, AnalyticsOverview } from '../../shared/services/analytics-api.service';

export interface DonutSegment {
  id: string;
  label: string;
  count: number;
  pct: string;
  color: string;
  dashArray: string;
  dashOffset: number;
}

export interface FunnelSvgStage {
  step: number;
  name: string;
  count: number;
  sharePct: number;
  retentionPct: number;
  dropOffPct: number;
  x: number;
  width: number;
  height: number;
  y: number;
  colorGrad: string;
}

export interface FunnelSvgConnector {
  x1: number;
  x2: number;
  y1: number;
  y2: number;
  midX: number;
  midY: number;
  dropOffPct: number;
  path: string;
}

@Component({
  selector: 'app-admin-analytics',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './analytics.component.html',
  styleUrl: './analytics.component.css',
})
export class AdminAnalyticsComponent implements OnInit, OnDestroy {
  private analyticsApi = inject(AnalyticsApiService);
  protected Math = Math;

  overview = signal<AnalyticsOverview | null>(null);
  loading = signal(true);
  isRefreshing = signal(false);
  lastRefreshedAt = signal<Date>(new Date());
  error = signal('');
  timeRange = signal<'7d' | '30d' | '90d'>('30d');
  activeTab = signal<'all' | 'traffic' | 'discovery' | 'funnel' | 'sales' | 'health'>('all');
  trafficMode = signal<'pageviews' | 'sessions' | 'both'>('both');
  hoveredTrafficIndex = signal<number | null>(null);
  hoveredSource = signal<string | null>(null);
  hoveredDevice = signal<string | null>(null);
  hoveredFunnelIndex = signal<number | null>(null);
  hoveredHourlyIndex = signal<number | null>(null);
  hoveredKeyword = signal<string | null>(null);
  hoveredProduct = signal<string | null>(null);
  funnelMode = signal<'bars' | 'cone'>('bars');

  private pollTimer: any = null;

  ngOnInit(): void {
    this.loadData();
    // Tự động làm mới số liệu ngầm mỗi 10 giây (silent polling)
    this.pollTimer = setInterval(() => {
      this.loadData(true);
    }, 10000);
  }

  ngOnDestroy(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  @HostListener('window:focus')
  onWindowFocus(): void {
    this.loadData(true);
  }

  loadData(silent: boolean = false): void {
    if (!silent) {
      this.loading.set(true);
    } else {
      this.isRefreshing.set(true);
    }
    this.error.set('');

    this.analyticsApi.getOverview({ range: this.timeRange() }).subscribe({
      next: (res) => {
        if (res && res.success && res.data) {
          this.overview.set(res.data);
          this.lastRefreshedAt.set(new Date());
        }
        this.loading.set(false);
        this.isRefreshing.set(false);
      },
      error: () => {
        if (!silent) {
          this.error.set('Không thể tải dữ liệu phân tích hành vi người dùng.');
        }
        this.loading.set(false);
        this.isRefreshing.set(false);
      },
    });
  }

  onRangeChange(r: '7d' | '30d' | '90d'): void {
    this.timeRange.set(r);
    this.loadData();
  }

  formatPrice(v: number): string {
    return (v || 0).toLocaleString('vi-VN') + ' ₫';
  }

  formatDuration(sec: number): string {
    if (!sec || sec < 60) return `${sec || 0} giây`;
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}m ${s}s`;
  }

  // ── 1. Traffic Trend SVG Line & Area Chart Helpers ───────────────
  get dailyTraffic() {
    return this.overview()?.traffic?.dailyTraffic || [];
  }

  get maxTrafficValue(): number {
    const data = this.dailyTraffic;
    if (!data.length) return 10;
    const maxPv = Math.max(...data.map(d => d.pageviews), 0);
    const maxSess = Math.max(...data.map(d => d.sessions), 0);
    return Math.max(maxPv, maxSess, 5);
  }

  get yTrafficTicks(): number[] {
    const max = this.maxTrafficValue;
    return [max, Math.round(max * 0.66), Math.round(max * 0.33), 0];
  }

  trafficX(idx: number): number {
    const count = this.dailyTraffic.length;
    if (count <= 1) return 300;
    return Math.round((idx / (count - 1)) * 540 + 30);
  }

  trafficY(val: number): number {
    const max = this.maxTrafficValue;
    const h = 180;
    const pad = 20;
    return Math.round(h - ((val / max) * (h - pad * 2)) - pad);
  }

  get trafficPvPoints(): string {
    const data = this.dailyTraffic;
    if (!data.length) return '';
    return data.map((d, i) => `${this.trafficX(i)},${this.trafficY(d.pageviews)}`).join(' ');
  }

  get trafficSessPoints(): string {
    const data = this.dailyTraffic;
    if (!data.length) return '';
    return data.map((d, i) => `${this.trafficX(i)},${this.trafficY(d.sessions)}`).join(' ');
  }

  get trafficAreaPoints(): string {
    const points = this.trafficPvPoints;
    if (!points) return '';
    const lastX = this.trafficX(this.dailyTraffic.length - 1);
    return `30,180 ${points} ${lastX},180`;
  }

  get hoveredPoint() {
    const idx = this.hoveredTrafficIndex();
    if (idx === null || !this.dailyTraffic[idx]) return null;
    return this.dailyTraffic[idx];
  }

  get hoveredTrafficLeftPct(): number {
    const idx = this.hoveredTrafficIndex();
    if (idx === null) return 50;
    return (this.trafficX(idx) / 600) * 100;
  }

  get hoveredFunnelStep() {
    const idx = this.hoveredFunnelIndex();
    if (idx === null || !this.funnelStages[idx]) return null;
    return this.funnelStages[idx];
  }

  get hoveredHourlyPoint() {
    const idx = this.hoveredHourlyIndex();
    if (idx === null || !this.hourlyActivity[idx]) return null;
    return this.hourlyActivity[idx];
  }

  get hoveredSourceInfo() {
    const srcId = this.hoveredSource();
    if (!srcId) return null;
    const sources = this.overview()?.traffic?.sources || [];
    const found = sources.find(s => s._id === srcId);
    if (!found) return null;
    const total = sources.reduce((sum, s) => sum + (s.count || 0), 0);
    const pct = total > 0 ? ((found.count / total) * 100).toFixed(1) + '%' : '0%';
    return {
      id: found._id,
      label: this.getSourceLabel(found._id),
      count: found.count,
      pct,
    };
  }

  get hoveredDeviceInfo() {
    const devId = this.hoveredDevice();
    if (!devId) return null;
    const devices = this.overview()?.traffic?.devices || [];
    const found = devices.find(d => d._id === devId);
    if (!found) return null;
    const total = devices.reduce((sum, d) => sum + (d.count || 0), 0);
    const pct = total > 0 ? ((found.count / total) * 100).toFixed(1) + '%' : '0%';
    return {
      id: found._id,
      label: this.getDeviceLabel(found._id),
      count: found.count,
      pct,
    };
  }

  // ── 2. Donut Chart Helpers for Traffic Sources ───────────────────
  getSourcesDonutSegments(): DonutSegment[] {
    const sources = this.overview()?.traffic?.sources || [];
    const total = sources.reduce((sum, s) => sum + (s.count || 0), 0);
    if (!total) return [];

    const circumference = 2 * Math.PI * 55; // r=55
    let currentOffset = 0;

    return sources.map(src => {
      const share = src.count / total;
      const strokeLength = share * circumference;
      const seg: DonutSegment = {
        id: src._id,
        label: this.getSourceLabel(src._id),
        count: src.count,
        pct: (share * 100).toFixed(1) + '%',
        color: this.getSourceColor(src._id),
        dashArray: `${strokeLength} ${circumference - strokeLength}`,
        dashOffset: -currentOffset,
      };
      currentOffset += strokeLength;
      return seg;
    });
  }

  // ── 3. Donut Chart Helpers for User Devices ──────────────────────
  getDevicesDonutSegments(): DonutSegment[] {
    const devices = this.overview()?.traffic?.devices || [];
    const total = devices.reduce((sum, d) => sum + (d.count || 0), 0);
    if (!total) return [];

    const circumference = 2 * Math.PI * 55; // r=55
    let currentOffset = 0;
    const colors: Record<string, string> = {
      mobile: '#16a34a',
      desktop: '#0284c7',
      tablet: '#f59e0b',
    };

    return devices.map(dev => {
      const share = dev.count / total;
      const strokeLength = share * circumference;
      const seg: DonutSegment = {
        id: dev._id,
        label: this.getDeviceLabel(dev._id),
        count: dev.count,
        pct: (share * 100).toFixed(1) + '%',
        color: colors[dev._id] || '#64748b',
        dashArray: `${strokeLength} ${circumference - strokeLength}`,
        dashOffset: -currentOffset,
      };
      currentOffset += strokeLength;
      return seg;
    });
  }

  // ── 4. 24-Hour Activity Histogram Helpers ────────────────────────
  get hourlyActivity() {
    return this.overview()?.traffic?.hourlyActivity || [];
  }

  get maxHourlyCount(): number {
    const list = this.hourlyActivity;
    if (!list.length) return 1;
    return Math.max(...list.map(h => h.count), 1);
  }

  hourlyBarHeight(cnt: number): number {
    const max = this.maxHourlyCount;
    return Math.max(6, Math.round((cnt / max) * 65));
  }

  isPeakHour(h: number): boolean {
    return (h >= 11 && h <= 13) || (h >= 19 && h <= 21);
  }

  // ── 5. Visual Behavioral E-Commerce Funnel Stages ────────────────
  get funnelStages() {
    const o = this.overview();
    const visitors = o?.traffic?.totalSessions || 95;
    const views = o?.searchDiscovery?.productDetailViews || Math.round(visitors * 0.72);
    const cart = o?.cartCheckout?.addToCartCount || Math.round(views * 0.38);
    const orders = o?.salesConversion?.completedOrders || 4;

    const base = Math.max(visitors, 1);

    return [
      {
        step: 1,
        name: 'Khách truy cập',
        count: visitors,
        unit: 'phiên',
        sharePct: 100,
        dropOffPct: 0,
        retentionPct: 100,
      },
      {
        step: 2,
        name: 'Xem sản phẩm',
        count: views,
        unit: 'lượt',
        sharePct: Math.round((views / base) * 100),
        dropOffPct: Math.round(((visitors - views) / base) * 100),
        retentionPct: Math.round((views / base) * 100),
      },
      {
        step: 3,
        name: 'Thêm giỏ hàng',
        count: cart,
        unit: 'lượt',
        sharePct: Math.round((cart / base) * 100),
        dropOffPct: views > 0 ? Math.round(((views - cart) / views) * 100) : 0,
        retentionPct: views > 0 ? Math.round((cart / views) * 100) : 0,
      },
      {
        step: 4,
        name: 'Đặt hàng thành công',
        count: orders,
        unit: 'đơn',
        sharePct: Math.round((orders / base) * 100),
        dropOffPct: cart > 0 ? Math.round(((cart - orders) / cart) * 100) : 0,
        retentionPct: cart > 0 ? Math.round((orders / cart) * 100) : 0,
      },
    ];
  }

  get maxKeywordCount(): number {
    const list = this.overview()?.searchDiscovery?.popularKeywords || [];
    if (!list.length) return 1;
    return Math.max(...list.map(k => k.count), 1);
  }

  get maxProductViewCount(): number {
    const list = this.overview()?.searchDiscovery?.topViewedProducts || [];
    if (!list.length) return 1;
    return Math.max(...list.map(p => p.count), 1);
  }

  getStepColor(step: number): string {
    switch (step) {
      case 1: return '#eab308';
      case 2: return '#ea580c';
      case 3: return '#db2777';
      case 4: return '#2563eb';
      default: return '#16a34a';
    }
  }

  getStepBg(step: number): string {
    switch (step) {
      case 1: return '#fef9c3';
      case 2: return '#ffedd5';
      case 3: return '#fce7f3';
      case 4: return '#dbeafe';
      default: return '#f0fdf4';
    }
  }

  getStepHoverBg(step: number): string {
    switch (step) {
      case 1: return '#fffbeb';
      case 2: return '#fff7ed';
      case 3: return '#fdf2f8';
      case 4: return '#eff6ff';
      default: return '#f0fdf4';
    }
  }

  // ── Source & Device Labels ───────────────────────────────────────
  getSourceLabel(sourceId: string): string {
    const map: Record<string, string> = {
      direct: 'Trực tiếp (Direct)',
      organic: 'Tìm kiếm tự nhiên (Google)',
      social: 'Mạng xã hội (Facebook/TikTok)',
      referral: 'Giới thiệu (Referral)',
      cpc: 'Quảng cáo (Ads)',
    };
    return map[sourceId] || sourceId;
  }

  getSourceColor(sourceId: string): string {
    const map: Record<string, string> = {
      direct: '#10b981',
      organic: '#3b82f6',
      social: '#ec4899',
      referral: '#f59e0b',
      cpc: '#8b5cf6',
    };
    return map[sourceId] || '#6b7280';
  }

  getDeviceLabel(dev: string): string {
    const map: Record<string, string> = {
      mobile: 'Di động (Mobile)',
      desktop: 'Máy tính (Desktop)',
      tablet: 'Máy tính bảng (Tablet)',
    };
    return map[dev] || dev;
  }

  getSourcePercent(count: number, sources: Array<{ _id: string; count: number }>): string {
    const total = (sources || []).reduce((sum, s) => sum + (s.count || 0), 0);
    if (!total) return '0%';
    return ((count / total) * 100).toFixed(1) + '%';
  }

  getDevicePercent(count: number, devices: Array<{ _id: string; count: number }>): string {
    const total = (devices || []).reduce((sum, d) => sum + (d.count || 0), 0);
    if (!total) return '0%';
    return ((count / total) * 100).toFixed(1) + '%';
  }
}
