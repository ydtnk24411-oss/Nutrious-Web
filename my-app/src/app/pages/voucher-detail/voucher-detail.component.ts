import { Component, OnInit, computed, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { switchMap, tap } from 'rxjs/operators';
import { of } from 'rxjs';
import { ShellComponent } from '../../components/shell/shell.component';
import { VoucherService } from '../../shared/services/voucher.service';
import { Voucher } from '../../shared/models/xanh-la.models';
import {
  buildVoucherConditionSections,
  buildVoucherVisual,
  formatVoucherDateVi,
  VoucherCardVisual,
  VoucherConditionSection,
} from '../../shared/utils/voucher-visual.util';

@Component({
  selector: 'app-voucher-detail',
  standalone: true,
  imports: [CommonModule, ShellComponent, RouterLink],
  templateUrl: './voucher-detail.component.html',
  styleUrl: './voucher-detail.component.css',
})
export class VoucherDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  protected voucherService = inject(VoucherService);

  voucher = signal<Voucher | null>(null);
  loading = signal<boolean>(true);
  notFound = signal<boolean>(false);
  toastMessage = signal<string>('');
  toastType = signal<'success' | 'error'>('success');
  private toastTimer: any = null;

  readonly visual = computed<VoucherCardVisual | null>(() => {
    const v = this.voucher();
    return v ? buildVoucherVisual(v, 0) : null;
  });

  readonly conditionSections = computed<VoucherConditionSection[]>(() => {
    const v = this.voucher();
    return v ? buildVoucherConditionSections(v) : [];
  });

  readonly startDateFormatted = computed(() => formatVoucherDateVi(this.voucher()?.startDate));
  readonly endDateFormatted = computed(() => formatVoucherDateVi(this.voucher()?.endDate));

  readonly usageStats = computed(() => {
    const v = this.voucher();
    if (!v || !v.usageLimit || v.usageLimit <= 0) return null;
    const used = Math.min(v.usedCount || 0, v.usageLimit);
    const remaining = Math.max(0, v.usageLimit - used);
    const percent = Math.round((used / v.usageLimit) * 100);
    return { used, limit: v.usageLimit, remaining, percent };
  });

  readonly timeWindow = computed(() => {
    const v = this.voucher();
    return v ? this.voucherService.checkTimeWindow(v) : { valid: true };
  });

  readonly statusInfo = computed(() => {
    const v = this.voucher();
    if (!v) return { label: '', type: 'uncollected' as const };
    const saved = this.voucherService.getUserVoucher(v.id);
    if (!saved) return { label: 'Chưa lưu vào ví', type: 'uncollected' as const };
    if (saved.status === 'used') return { label: 'Đã sử dụng', type: 'used' as const };
    if (saved.status === 'expired') return { label: 'Đã hết hạn', type: 'expired' as const };
    return { label: 'Đã lưu trong ví (Sẵn sàng dùng)', type: 'available' as const };
  });

  readonly relatedVouchers = computed(() => {
    const current = this.voucher();
    const list = this.voucherService.publicVouchers();
    return list
      .filter((item) => !current || item.code !== current.code)
      .slice(0, 3)
      .map((item, idx) => ({
        voucher: item,
        visual: buildVoucherVisual(item, idx + 1),
        endDate: formatVoucherDateVi(item.endDate),
      }));
  });

  ngOnInit(): void {
    this.voucherService.loadPublic();
    this.voucherService.refreshMine();

    this.route.paramMap
      .pipe(
        tap(() => {
          this.loading.set(true);
          this.notFound.set(false);
        }),
        switchMap((params) => {
          const code = (params.get('code') || '').trim();
          if (!code) return of(null);
          return this.voucherService.getVoucherDetail(code);
        })
      )
      .subscribe((found) => {
        this.loading.set(false);
        if (found) {
          this.voucher.set(found);
          this.notFound.set(false);
          if (typeof window !== 'undefined') {
            window.scrollTo({ top: 0, behavior: 'smooth' });
          }
        } else {
          this.voucher.set(null);
          this.notFound.set(true);
        }
      });
  }

  copyCode(code: string): void {
    this.voucherService.copyCode(code);
    this.showToast(`Đã sao chép mã "${code}"! Bạn có thể dán ở bước Thanh toán.`, 'success');
  }

  collectVoucher(voucherId: string): void {
    this.voucherService.collectVoucher(voucherId).subscribe((res) => {
      if (res.success) {
        this.showToast('Đã lưu mã vào Ví Voucher của bạn!', 'success');
      } else {
        this.showToast(res.message || 'Không thể lưu mã vào ví lúc này.', 'error');
      }
    });
  }

  private showToast(msg: string, type: 'success' | 'error'): void {
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastMessage.set(msg);
    this.toastType.set(type);
    this.toastTimer = setTimeout(() => this.toastMessage.set(''), 4200);
  }
}

