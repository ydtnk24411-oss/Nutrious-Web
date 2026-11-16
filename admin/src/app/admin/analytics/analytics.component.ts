import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AnalyticsApiService, AnalyticsOverview } from '../../shared/services/analytics-api.service';

@Component({
  selector: 'app-admin-analytics',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './analytics.component.html',
  styleUrl: './analytics.component.css',
})
export class AdminAnalyticsComponent implements OnInit {
  private analyticsApi = inject(AnalyticsApiService);

  overview = signal<AnalyticsOverview | null>(null);
  loading = signal(true);
  error = signal('');
  timeRange = signal<'7d' | '30d' | '90d'>('30d');
  activeTab = signal<'all' | 'traffic' | 'discovery' | 'funnel' | 'sales' | 'health'>('all');

  ngOnInit(): void {
    this.loadData();
  }

  loadData(): void {
    this.loading.set(true);
    this.error.set('');
    this.analyticsApi.getOverview({ range: this.timeRange() }).subscribe({
      next: (res) => {
        if (res.success && res.data) {
          this.overview.set(res.data);
        }
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Không thể tải dữ liệu phân tích. Vui lòng thử lại sau.');
        this.loading.set(false);
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

  getDeviceIcon(dev: string): string {
    const map: Record<string, string> = {
      mobile: 'phone',
      desktop: 'display',
      tablet: 'tablet',
    };
    return map[dev] || 'device';
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
