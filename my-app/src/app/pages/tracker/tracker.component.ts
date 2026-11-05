import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ShellComponent } from '../../components/shell/shell.component';
import { OrderApiService, ApiOrder } from '../../shared/services/order-api.service';

@Component({
  selector: 'app-tracker',
  standalone: true,
  imports: [CommonModule, ShellComponent],
  templateUrl: './tracker.component.html',
  styleUrl: './tracker.component.css',
})
export class TrackerComponent {
  private orderApi = inject(OrderApiService);

  protected code     = signal('');
  protected loading  = signal(false);
  protected error    = signal('');
  protected order    = signal<ApiOrder | null>(null);

  readonly statusLabel: Record<string, string> = {
    pending:   'Đang chờ xử lý',
    confirmed: 'Đã xác nhận',
    preparing: 'Đang chuẩn bị',
    shipping:  'Đang giao hàng',
    delivered: 'Đã giao thành công',
    cancelled: 'Đã hủy',
  };

  readonly statusColor: Record<string, string> = {
    pending:   '#b7791f',
    confirmed: '#2b6cb0',
    preparing: '#6b46c1',
    shipping:  '#276749',
    delivered: '#276749',
    cancelled: '#c53030',
  };

  readonly statusSteps = ['pending', 'confirmed', 'preparing', 'shipping', 'delivered'];

  handleSubmit(e: Event): void {
    e.preventDefault();
    const code = this.code().trim().toUpperCase();
    if (!code) return;

    this.loading.set(true);
    this.error.set('');
    this.order.set(null);

    this.orderApi.track(code).subscribe({
      next: (res) => {
        this.order.set(res.data);
        this.loading.set(false);
      },
      error: (err) => {
        this.error.set(err.error?.message || 'Không tìm thấy đơn hàng.');
        this.loading.set(false);
      },
    });
  }

  stepActive(step: string): boolean {
    const o = this.order();
    if (!o) return false;
    if (o.status === 'cancelled') return false;
    return this.statusSteps.indexOf(step) <= this.statusSteps.indexOf(o.status);
  }

  formatPrice(v: number): string {
    return v.toLocaleString('vi-VN') + ' ₫';
  }
}
