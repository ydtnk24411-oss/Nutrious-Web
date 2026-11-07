import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ShellComponent } from '../../components/shell/shell.component';
import { OrderApiService } from '../../shared/services/order-api.service';

interface OrderItem {
  productName: string;
  productImage: string;
  productPrice: number;
  quantity: number;
  selectedOption?: string;
  isCombo?: boolean;
  comboItems?: {
    name: string;
    price?: string;
    image?: string;
    weight?: string;
    unit?: string;
    quantity: number;
  }[];
}

interface Order {
  _id: string;
  orderCode: string;
  guestName: string;
  guestEmail: string;
  guestPhone: string;
  items: OrderItem[];
  subtotal: number;
  comboDiscount?: number;
  discount: number;
  voucherCode?: string;
  shippingFee: number;
  total: number;
  shippingMethod: 'pickup' | 'delivery';
  shippingAddress?: string;
  paymentMethod: 'cod' | 'bank_transfer';
  status: 'pending' | 'confirmed' | 'preparing' | 'shipping' | 'delivered' | 'cancelled';
  estimatedPoints?: number;
  createdAt: string;
  updatedAt: string;
}

@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [CommonModule, ShellComponent, RouterLink],
  templateUrl: './order-detail.component.html',
  styleUrl: './order-detail.component.css',
})
export class OrderDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private orderApi = inject(OrderApiService);

  order = signal<Order | null>(null);
  loading = signal(true);
  error = signal('');
  cancelling = signal(false);

  get orderData(): Order | null {
    return this.order();
  }

  ngOnInit(): void {
    const orderCode = this.route.snapshot.paramMap.get('orderCode');
    if (!orderCode) {
      this.error.set('Không tìm thấy mã đơn hàng');
      this.loading.set(false);
      return;
    }

    // Demo data for now - in production, fetch from API
    this.orderApi.track(orderCode).subscribe({
      next: (res) => {
        if (res?.success && res?.data) {
          this.order.set(res.data as any);
        } else {
          this.loadOrderDemo(orderCode);
        }
        this.loading.set(false);
      },
      error: () => {
        this.loadOrderDemo(orderCode);
      }
    });
  }

  private loadOrderDemo(orderCode: string): void {
    // Simulate API call with demo data
    setTimeout(() => {
      this.order.set({
        _id: 'demo',
        orderCode,
        guestName: 'Nguyễn Văn A',
        guestEmail: 'nguyenvan@gmail.com',
        guestPhone: '0987 654 321',
        items: [
          {
            productName: 'Rau Muống Tươi',
            productImage: 'https://images.unsplash.com/photo-1596040033229-a9821ebd058d?w=200',
            productPrice: 8000,
            quantity: 2,
            selectedOption: '500g',
          },
          {
            productName: 'Cà Rốt Baby Đà Lạt',
            productImage: 'https://images.unsplash.com/photo-1598170845058-32b9d6a5da37?w=200',
            productPrice: 32000,
            quantity: 1,
            selectedOption: '1kg',
          },
        ],
        subtotal: 48000,
        discount: 0,
        shippingFee: 0,
        total: 48000,
        shippingMethod: 'delivery',
        shippingAddress: '123 Đường ABC, Quận 1, TP. Hồ Chí Minh',
        paymentMethod: 'cod',
        status: 'shipping',
        estimatedPoints: 48,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      this.loading.set(false);
    }, 500);
  }

  getStatusText(status: string): string {
    const statusMap: Record<string, string> = {
      pending: 'Chờ xác nhận',
      confirmed: 'Đã xác nhận',
      preparing: 'Đang chuẩn bị',
      shipping: 'Đang giao',
      delivered: 'Đã giao',
      cancelled: 'Đã hủy',
    };
    return statusMap[status] || status;
  }

  getStatusClass(status: string): string {
    const classMap: Record<string, string> = {
      pending: 'status-pending',
      confirmed: 'status-confirmed',
      preparing: 'status-preparing',
      shipping: 'status-shipping',
      delivered: 'status-delivered',
      cancelled: 'status-cancelled',
    };
    return classMap[status] || '';
  }

  getStatusSteps(): { status: string; label: string; completed: boolean; active: boolean }[] {
    const currentOrder = this.order();
    if (!currentOrder) return [];

    const steps = [
      { status: 'pending', label: 'Chờ xác nhận', completed: false, active: false },
      { status: 'confirmed', label: 'Đã xác nhận', completed: false, active: false },
      { status: 'preparing', label: 'Đang chuẩn bị', completed: false, active: false },
      { status: 'shipping', label: 'Đang giao', completed: false, active: false },
      { status: 'delivered', label: 'Đã giao', completed: false, active: false },
    ];

    const currentIndex = steps.findIndex(s => s.status === currentOrder.status);
    if (currentIndex === -1) return steps;

    steps.forEach((step, index) => {
      step.completed = index < currentIndex;
      step.active = index === currentIndex;
    });

    // Handle cancelled status
    if (currentOrder.status === 'cancelled') {
      steps.forEach(s => {
        s.completed = false;
        s.active = false;
      });
    }

    return steps;
  }

  formatPrice(value: number | string): string {
    const num = typeof value === 'number' ? value : Number(String(value || 0).replace(/[^\d]/g, ''));
    return num.toLocaleString('vi-VN') + 'đ';
  }

  getComboItemImage(sub: any): string {
    return sub?.image || sub?.product?.image || '';
  }

  getComboItemName(sub: any): string {
    return sub?.name || sub?.product?.name || 'Sản phẩm thành phần';
  }

  getComboItemPrice(sub: any): string {
    if (sub?.price) return String(sub.price);
    if (sub?.product?.price) return String(sub.product.price);
    if (sub?.priceNumber) return this.formatPrice(sub.priceNumber);
    if (sub?.product?.priceNumber) return this.formatPrice(sub.product.priceNumber);
    return '';
  }

  formatDate(date: string): string {
    return new Date(date).toLocaleString('vi-VN');
  }

  cancelOrder(): void {
    const currentOrder = this.order();
    if (!currentOrder || this.cancelling()) return;

    if (!confirm(`Bạn có chắc chắn muốn hủy đơn hàng ${currentOrder.orderCode}?`)) {
      return;
    }

    this.cancelling.set(true);
    const targetId = currentOrder.orderCode || currentOrder._id;

    this.orderApi.cancel(targetId).subscribe({
      next: (res) => {
        this.cancelling.set(false);
        if (res?.success) {
          alert('Đơn hàng đã được hủy thành công!');
          // Cập nhật trạng thái hiển thị của đơn hàng trên UI ngay lập tức
          this.order.update(o => o ? { ...o, status: 'cancelled' } : null);
        } else {
          alert(res?.message || 'Không thể hủy đơn hàng.');
        }
      },
      error: (err) => {
        this.cancelling.set(false);
        console.error('Cancel order error:', err);
        const errMsg = err?.error?.message || 'Hủy đơn hàng thất bại. Vui lòng thử lại sau.';
        alert(errMsg);
      }
    });
  }
}
