import { Component, signal, inject, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { OrderApiService, ApiOrder } from '../../shared/services/order-api.service';

@Component({
  selector: 'app-admin-orders',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './orders.component.html',
  styleUrl: './orders.component.css',
})
export class AdminOrdersComponent implements OnInit {
  private orderApi = inject(OrderApiService);

  orders   = signal<ApiOrder[]>([]);
  total    = signal(0);
  loading  = signal(true);
  error    = signal('');
  success  = signal('');

  // filters
  search   = signal('');
  status   = signal('');
  page     = signal(1);
  readonly limit = 15;

  // detail modal
  selected    = signal<ApiOrder | null>(null);
  detailOpen  = signal(false);
  updatingStatus = signal(false);
  confirmingPayment = signal(false);
  newStatus   = signal('');

  totalPages = computed(() => Math.ceil(this.total() / this.limit));

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
    pickup: 'Đến lấy trực tiếp', delivery: 'Giao hàng tận nơi',
  };

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    this.error.set('');
    const params: Record<string, string | number> = { page: this.page(), limit: this.limit };
    if (this.search())  params['search'] = this.search();
    if (this.status())  params['status'] = this.status();

    console.log('Loading orders with params:', params);

    this.orderApi.getAll(params).subscribe({
      next:  (res) => {
        console.log('Orders response:', res);
        this.orders.set(res.data);
        this.total.set(res.total);
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Failed to load orders:', err);
        this.error.set(err.error?.message || 'Không thể tải đơn hàng.');
        this.loading.set(false);
      },
    });
  }

  onSearch(v: string): void { this.search.set(v); this.page.set(1); this.load(); }
  onStatus(v: string): void { this.status.set(v); this.page.set(1); this.load(); }
  prevPage(): void { if (this.page() > 1)              { this.page.update(p => p - 1); this.load(); } }
  nextPage(): void { if (this.page() < this.totalPages()){ this.page.update(p => p + 1); this.load(); } }

  openDetail(o: ApiOrder): void {
    this.selected.set(o);
    this.newStatus.set(o.status);
    this.detailOpen.set(true);
    this.error.set('');
  }
  closeDetail(): void { this.detailOpen.set(false); this.selected.set(null); }

  updateStatus(): void {
    const o = this.selected();
    if (!o || !this.newStatus()) return;
    this.updatingStatus.set(true);
    this.orderApi.updateStatus(o._id, this.newStatus() as ApiOrder['status']).subscribe({
      next: (res) => {
        this.updatingStatus.set(false);
        this.selected.set(res.data);
        this.success.set('Đã cập nhật trạng thái!');
        setTimeout(() => this.success.set(''), 3000);
        this.load();
      },
      error: (err) => {
        this.updatingStatus.set(false);
        this.error.set(err.error?.message || 'Cập nhật thất bại.');
      },
    });
  }

  canConfirmQrPayment(o: ApiOrder): boolean {
    return (
      o.paymentMethod === 'bank_transfer' &&
      o.paymentStatus !== 'paid' &&
      o.paymentStatus !== 'expired' &&
      o.status !== 'cancelled'
    );
  }

  confirmPayment(o: ApiOrder): void {
    if (!o || !this.canConfirmQrPayment(o) || this.confirmingPayment()) return;
    this.confirmingPayment.set(true);
    this.error.set('');
    this.orderApi.confirmPayment(o._id, 'ADMIN_CONFIRMED').subscribe({
      next: (res) => {
        this.confirmingPayment.set(false);
        if (this.selected()?._id === o._id && res.data) {
          this.selected.set(res.data);
          this.newStatus.set(res.data.status);
        }
        this.success.set(`Đã xác nhận thanh toán VietQR cho đơn ${o.orderCode}!`);
        setTimeout(() => this.success.set(''), 3500);
        this.load();
      },
      error: (err) => {
        this.confirmingPayment.set(false);
        this.error.set(err.error?.message || 'Xác nhận thanh toán thất bại.');
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
}
