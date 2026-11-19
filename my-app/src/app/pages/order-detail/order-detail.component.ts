// Updated order cancellation rules
import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { ShellComponent } from '../../components/shell/shell.component';
import { OrderApiService } from '../../shared/services/order-api.service';

interface OrderItem {
  productName: string;
  productImage: string;
  productPrice: number | string;
  priceNumber?: number;
  originalPriceNumber?: number;
  comboSaving?: number;
  itemType?: 'regular' | 'combo' | 'addon';
  linkedMainProduct?: string;
  linkedMainProductName?: string;
  addonSaving?: number;
  discountedByAddon?: boolean;
  promoNote?: string;
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
  addonDiscount?: number;
  discount: number;
  voucherCode?: string;
  shippingFee: number;
  total: number;
  shippingMethod: 'pickup' | 'delivery';
  shippingAddress?: string;
  paymentMethod: 'cod' | 'bank_transfer';
  paymentStatus?: 'unpaid' | 'paid' | 'expired';
  paymentExpiresAt?: string | null;
  paidAt?: string | null;
  qrUrl?: string | null;
  bankInfo?: { bankId: string; accountNo: string; accountName: string } | null;
  status: 'pending' | 'confirmed' | 'preparing' | 'shipping' | 'delivered' | 'cancelled';
  hasNonRefundableItems?: boolean;
  nonRefundableAccepted?: boolean;
  nonRefundableItems?: Array<{ name: string; categoryName: string; isCombo?: boolean }>;
  estimatedPoints?: number;
  createdAt: string;
  updatedAt: string;
}

@Component({
  selector: 'app-order-detail',
  standalone: true,
  imports: [CommonModule, FormsModule, ShellComponent, RouterLink],
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

  // Modal hủy đơn hàng đa bước (Customer Retention Flow)
  showCancelModal = signal(false);
  selectedCancelReason = signal('');
  cancelDetailReason = signal('');
  confirmedLossPolicy = signal(false);

  readonly cancelReasons = [
    'Tôi muốn thay đổi địa chỉ hoặc số điện thoại nhận hàng',
    'Tôi muốn đổi hình thức thanh toán / áp dụng voucher khác',
    'Tôi chọn nhầm phân loại / muốn thay đổi số lượng sản phẩm',
    'Thời gian giao hàng dự kiến không phù hợp với tôi',
    'Tôi tìm thấy sản phẩm có giá tốt hơn ở nơi khác',
    'Tôi đổi ý, hiện không còn nhu cầu mua đơn hàng này nữa',
    'Lý do cá nhân khác...',
  ];

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

  itemLinePayable(item: OrderItem): number {
    const unit = typeof item.priceNumber === 'number'
      ? item.priceNumber
      : (typeof item.productPrice === 'number' ? item.productPrice : Number(String(item.productPrice || 0).replace(/[^\d]/g, '')));
    return unit * (item.quantity || 1);
  }

  itemLineOriginal(item: OrderItem): number {
    const orig = item.originalPriceNumber && item.originalPriceNumber > 0
      ? item.originalPriceNumber
      : (typeof item.priceNumber === 'number' ? item.priceNumber : 0);
    return orig * (item.quantity || 1);
  }

  getComboItemImage(sub: any): string {
    return sub?.image || sub?.product?.image || '';
  }

  getComboItemName(sub: any): string {
    return sub?.name || sub?.product?.name || 'Sản phẩm thành phần';
  }

  getComboItemQty(sub: any): number {
    return Math.max(1, Number(sub?.quantity) || 1);
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
    if (!this.canCancelOrder()) {
      alert('Đơn hàng đã bước sang khâu chuẩn bị hàng hoặc đang giao, không thể hủy lúc này.');
      return;
    }
    this.openCancelModal();
  }

  
  canCancelOrder(): boolean {
    const o = this.order();
    if (!o) return false;
    // Cho phép hủy khi ở trạng thái 'pending' hoặc 'confirmed'
    return o.status === 'pending' || o.status === 'confirmed';
  }

  openCancelModal(): void {
    this.selectedCancelReason.set('');
    this.cancelDetailReason.set('');
    this.confirmedLossPolicy.set(false);
    this.showCancelModal.set(true);
  }

  closeCancelModal(): void {
    if (this.cancelling()) return;
    this.showCancelModal.set(false);
  }

  confirmCancelOrder(): void {
    const currentOrder = this.order();
    if (!currentOrder || this.cancelling()) return;

    if (!this.canCancelOrder()) {
      alert('Đơn hàng đã bước sang khâu chuẩn bị hàng hoặc đang giao, không thể hủy lúc này.');
      return;
    }

    const mainReason = this.selectedCancelReason().trim();
    if (!mainReason) {
      alert('Vui lòng chọn một lý do hủy đơn hàng.');
      return;
    }

    const detail = this.cancelDetailReason().trim();
    if (detail.length < 10) {
      alert('Vui lòng nhập mô tả chi tiết lý do (tối thiểu 10 ký tự) để Evergreen Mart ghi nhận và cải thiện dịch vụ.');
      return;
    }

    if (!this.confirmedLossPolicy()) {
      alert('Vui lòng tích xác nhận bạn đã hiểu các mã ưu đãi sẽ không được bảo lưu.');
      return;
    }

    this.cancelling.set(true);
    const fullReason = `${mainReason} - Chi tiết: ${detail}`;
    const targetId = currentOrder.orderCode || currentOrder._id;

    this.orderApi.cancel(targetId, fullReason).subscribe({
      next: (res) => {
        this.cancelling.set(false);
        this.showCancelModal.set(false);
        if (res?.success) {
          alert('Đơn hàng đã được hủy thành công.');
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

  printOrder(): void {
    const ord = this.order();
    if (!ord) return;

    const printWin = window.open('', '_blank', 'width=850,height=950');
    if (!printWin) {
      window.print();
      return;
    }

    const fmtMoney = (v?: number) => (v || 0).toLocaleString('vi-VN') + ' ₫';
    const itemsHtml = (ord.items || []).map((it, idx) => {
      const price = typeof it.priceNumber === 'number'
        ? it.priceNumber
        : (Number(String(it.productPrice).replace(/[^0-9]/g, '')) || 0);
      const lineTotal = price * (it.quantity || 1);
      return `
        <tr>
          <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;text-align:center">${idx + 1}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb">
            <div style="font-weight:700;color:#111827">${it.productName}</div>
            ${it.selectedOption ? `<div style="font-size:12px;color:#6b7280;margin-top:2px">${it.selectedOption}</div>` : ''}
            ${it.isCombo && it.comboItems?.length ? `<div style="font-size:11.5px;color:#059669;margin-top:2px">Combo: ${it.comboItems.map(c => c.name).join(', ')}</div>` : ''}
          </td>
          <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;text-align:center;font-weight:600">${it.quantity}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;text-align:right">${fmtMoney(price)}</td>
          <td style="padding:10px 8px;border-bottom:1px solid #e5e7eb;text-align:right;font-weight:700">${fmtMoney(lineTotal)}</td>
        </tr>
      `;
    }).join('');

    const statusText = this.getStatusText(ord.status);
    let stampClass = 'stamp-unpaid';
    let stampText = 'CHƯA THANH TOÁN (TẠM TÍNH)';

    if (ord.status === 'cancelled') {
      stampClass = 'stamp-cancelled';
      stampText = 'ĐƠN HÀNG ĐÃ HỦY (VÔ HIỆU)';
    } else if (ord.paymentStatus === 'paid') {
      stampClass = 'stamp-paid';
      stampText = 'ĐÃ THANH TOÁN';
    } else if (ord.paymentMethod === 'cod') {
      stampClass = 'stamp-cod';
      stampText = 'THU TIỀN KHI GIAO (COD)';
    }

    const paymentText = ord.paymentMethod === 'bank_transfer'
      ? (ord.paymentStatus === 'paid' ? 'Chuyển khoản VietQR (ĐÃ THANH TOÁN)' : 'Chuyển khoản VietQR (CHƯA THANH TOÁN)')
      : 'Thu tiền khi nhận hàng (COD)';


    const html = `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="utf-8">
  <title>Phiếu Giao Hàng - #${ord.orderCode}</title>
  <style>
    @page { size: A4 portrait; margin: 12mm 15mm; }
    * { box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      color: #1f2937;
      margin: 0;
      padding: 24px;
      font-size: 13px;
      line-height: 1.5;
      background: #fff;
    }
    .invoice-card {
      max-width: 800px;
      margin: 0 auto;
      position: relative;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 2.5px solid #166534;
      padding-bottom: 14px;
      margin-bottom: 18px;
    }
    .store-name {
      font-size: 22px;
      font-weight: 800;
      color: #166534;
      letter-spacing: -0.01em;
      text-transform: uppercase;
    }
    .store-info {
      font-size: 12px;
      color: #4b5563;
      margin-top: 2px;
    }
    .invoice-title {
      font-size: 18px;
      font-weight: 800;
      color: #111827;
      text-align: right;
    }
    .invoice-meta {
      font-size: 12px;
      color: #6b7280;
      margin-top: 3px;
      text-align: right;
    }
    .stamp-container {
      position: absolute;
      top: 90px;
      right: 20px;
      pointer-events: none;
      z-index: 10;
    }
    .stamp {
      display: inline-block;
      padding: 6px 14px;
      font-size: 13px;
      font-weight: 850;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      border-radius: 6px;
      transform: rotate(-10deg);
      border-width: 2.5px;
      border-style: solid;
      box-shadow: 0 2px 8px rgba(0,0,0,0.06);
    }
    .stamp-paid {
      color: #15803d;
      border-color: #15803d;
      background: rgba(220, 252, 231, 0.7);
    }
    .stamp-unpaid {
      color: #b45309;
      border-color: #b45309;
      background: rgba(254, 243, 199, 0.7);
    }
    .stamp-cod {
      color: #1d4ed8;
      border-color: #1d4ed8;
      background: rgba(219, 234, 254, 0.7);
    }
    .stamp-cancelled {
      color: #b91c1c;
      border-color: #b91c1c;
      background: rgba(254, 226, 226, 0.85);
      font-size: 15px;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 14px 18px;
      margin-bottom: 20px;
    }
    .info-col dt {
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      color: #64748b;
      margin-top: 6px;
    }
    .info-col dt:first-child { margin-top: 0; }
    .info-col dd {
      margin: 2px 0 0;
      font-size: 13px;
      color: #0f172a;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 18px;
    }
    th {
      background: #f1f5f9;
      color: #334155;
      padding: 10px 8px;
      font-size: 12px;
      font-weight: 700;
      text-align: left;
      border-top: 1px solid #cbd5e1;
      border-bottom: 2px solid #cbd5e1;
    }
    .totals-wrap {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 24px;
    }
    .totals-table {
      width: 320px;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      padding: 5px 0;
      font-size: 13px;
      color: #374151;
    }
    .totals-row.discount {
      color: #dc2626;
    }
    .totals-row.final {
      font-size: 16px;
      font-weight: 800;
      color: #166534;
      border-top: 2px solid #e2e8f0;
      margin-top: 6px;
      padding-top: 8px;
    }
    .signatures {
      display: grid;
      grid-template-columns: 1fr 1fr 1fr;
      text-align: center;
      margin-top: 36px;
      page-break-inside: avoid;
    }
    .sig-label {
      font-weight: 700;
      font-size: 13px;
      color: #1e293b;
    }
    .sig-sub {
      font-size: 11.5px;
      color: #64748b;
      margin-top: 2px;
      margin-bottom: 54px;
    }

    @media print {
      body { padding: 0; }
      .no-print { display: none !important; }
    }
  </style>
</head>
<body>
  <div class="invoice-card">
    <div class="stamp-container">
      <div class="stamp ${stampClass}">${stampText}</div>
    </div>

    <div class="header">
      <div>
        <div class="store-name">Evergreen Mart</div>
        <div class="store-info">Nông sản sạch VietGAP &amp; Thực phẩm dinh dưỡng</div>
        <div class="store-info">Hotline CSKH: 1800 6999 (Miễn phí) - www.evergreenmart.vn</div>
      </div>
      <div>
        <div class="invoice-title">PHIẾU GIAO HÀNG &amp; ĐỐI SOÁT</div>
        <div class="invoice-meta">Mã đơn: <strong style="color:#0f172a;font-size:14px">#${ord.orderCode}</strong></div>
        <div class="invoice-meta">Ngày đặt: ${this.formatDate(ord.createdAt)}</div>
        <div class="invoice-meta">Trạng thái: <strong style="color:#166534">${statusText}</strong></div>
      </div>
    </div>

    <div class="info-grid">
      <div class="info-col">
        <dt>Người nhận hàng</dt>
        <dd><strong>${ord.guestName || 'Khách lẻ'}</strong></dd>
        <dt>Số điện thoại</dt>
        <dd><strong>${ord.guestPhone || '---'}</strong></dd>
        <dt>Email</dt>
        <dd>${ord.guestEmail || '---'}</dd>
        <dt>Hình thức nhận hàng</dt>
        <dd>${ord.shippingMethod === 'delivery' ? 'Giao hàng tận nơi' : 'Đến lấy trực tiếp'}</dd>
      </div>
      <div class="info-col">
        <dt>Địa chỉ giao hàng</dt>
        <dd><strong>${ord.shippingAddress || 'Nhận tại quầy'}</strong></dd>
        <dt>Hình thức thanh toán</dt>
        <dd><strong>${paymentText}</strong></dd>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th style="width:38px;text-align:center">STT</th>
          <th>Tên sản phẩm</th>
          <th style="width:60px;text-align:center">Số lượng</th>
          <th style="width:110px;text-align:right">Đơn giá</th>
          <th style="width:120px;text-align:right">Thành tiền</th>
        </tr>
      </thead>
      <tbody>
        ${itemsHtml}
      </tbody>
    </table>

    <div class="totals-wrap">
      <div class="totals-table">
        <div class="totals-row">
          <span>Tiền hàng:</span>
          <span>${fmtMoney(ord.subtotal)}</span>
        </div>
        ${ord.discount > 0 ? `
        <div class="totals-row discount">
          <span>Giảm giá${ord.voucherCode ? ` (${ord.voucherCode})` : ''}:</span>
          <span>-${fmtMoney(ord.discount)}</span>
        </div>` : ''}
        <div class="totals-row">
          <span>Phí giao hàng:</span>
          <span>${fmtMoney(ord.shippingFee)}</span>
        </div>
        <div class="totals-row final">
          <span>TỔNG THANH TOÁN:</span>
          <span>${fmtMoney(ord.total)}</span>
        </div>
        ${ord.estimatedPoints ? `
        <div class="totals-row" style="font-size:11.5px;color:#16a34a">
          <span>Điểm tích lũy nhận được:</span>
          <span>+${ord.estimatedPoints} điểm</span>
        </div>` : ''}
      </div>
    </div>

    <div class="signatures">
      <div>
        <div class="sig-label">Khách nhận hàng</div>
        <div class="sig-sub">(Ký &amp; ghi rõ họ tên)</div>
      </div>
      <div>
        <div class="sig-label">Nhân viên giao hàng</div>
        <div class="sig-sub">(Ký &amp; ghi rõ họ tên)</div>
      </div>
      <div>
        <div class="sig-label">Đại diện cửa hàng</div>
        <div class="sig-sub">(Ký &amp; ghi rõ họ tên)</div>
      </div>
    </div>

    <div style="text-align:center;font-size:12px;color:#64748b;margin-top:36px;border-top:1px dashed #e2e8f0;padding-top:14px;font-style:italic">
      Cảm ơn quý khách đã tin chọn Evergreen Mart! Kính chúc quý khách và gia đình luôn dồi dào sức khỏe.
    </div>
  </div>
</body>
</html>`;

    printWin.document.open();
    printWin.document.write(html);
    printWin.document.close();
    printWin.focus();
    setTimeout(() => {
      printWin.print();
    }, 350);
  }
}