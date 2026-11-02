import { Component, signal, inject, computed } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ShellComponent } from '../../components/shell/shell.component';
import { CartService, formatPrice } from '../../shared/services/cart.service';
import { OrderApiService } from '../../shared/services/order-api.service';
import { VoucherService } from '../../shared/services/voucher.service';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, FormsModule, ShellComponent, RouterLink],
  templateUrl: './checkout.component.html',
  styleUrl: './checkout.component.css',
})
export class CheckoutComponent {
  protected cart     = inject(CartService);
  private orderApi   = inject(OrderApiService);
  private router     = inject(Router);
  private voucher   = inject(VoucherService);
  protected formatPrice = formatPrice;

  protected completed      = signal(false);
  protected orderCode      = signal('');
  protected submitting     = signal(false);
  protected errorMsg       = signal('');
  protected shippingMethod = signal<'pickup' | 'delivery'>('pickup');
  protected paymentMethod  = signal<'cod' | 'bank_transfer'>('cod');

  // Voucher
  protected voucherCode = signal('');
  protected selectedVoucher = signal<any>(null);
  protected voucherDiscount = signal(0);
  protected voucherMessage = signal('');

  // Loyalty points estimate
  readonly estimatedPoints = computed(() => {
    const subtotal = this.cart.subtotal();
    return Math.floor(subtotal / 1000); // 1 điểm cho mỗi 1000đ
  });

  // Total after discount
  readonly finalTotal = computed(() => {
    return Math.max(0, this.cart.subtotal() - this.voucherDiscount());
  });

  // form fields
  protected guestName    = signal(this.cart.currentUser()?.name  ?? '');
  protected guestPhone   = signal(this.cart.currentUser()?.phone ?? '');
  protected guestEmail   = signal(this.cart.currentUser()?.email ?? '');
  protected shippingAddr = signal(this._defaultAddress());

  /** Địa chỉ mặc định của tài khoản đang đăng nhập (để điền sẵn khi giao hàng). */
  private _defaultAddress(): string {
    const addrs = this.cart.currentUser()?.addresses ?? [];
    const a = addrs.find((x) => x.isDefault) ?? addrs[0];
    return a ? [a.address, a.city].filter(Boolean).join(', ') : '';
  }

  applyVoucher(): void {
    const code = this.voucherCode().trim();
    if (!code) {
      this.voucherMessage.set('Vui lòng nhập mã voucher');
      return;
    }

    this.voucher.validateVoucher(code, this.cart.subtotal()).subscribe((result) => {
      if (result.valid) {
        this.selectedVoucher.set({ code, discount: result.discount });
        this.voucherDiscount.set(result.discount);
        this.voucherMessage.set(`Đã áp dụng: Giảm ${formatPrice(result.discount)}`);
      } else {
        this.selectedVoucher.set(null);
        this.voucherDiscount.set(0);
        this.voucherMessage.set(result.message || 'Mã voucher không hợp lệ');
      }
    });
  }

  removeVoucher(): void {
    this.selectedVoucher.set(null);
    this.voucherDiscount.set(0);
    this.voucherCode.set('');
    this.voucherMessage.set('');
  }

  handleSubmit(e: Event): void {
    e.preventDefault();

    if (this.cart.items().length === 0) {
      this.errorMsg.set('Giỏ hàng trống, vui lòng thêm sản phẩm trước.'); return;
    }
    if (!this.guestName() || !this.guestPhone() || !this.guestEmail()) {
      this.errorMsg.set('Vui lòng điền đầy đủ thông tin liên hệ.'); return;
    }
    if (this.shippingMethod() === 'delivery' && !this.shippingAddr()) {
      this.errorMsg.set('Vui lòng nhập địa chỉ giao hàng.'); return;
    }

    this.submitting.set(true);
    this.errorMsg.set('');

    // Build order payload — product field là MongoDB _id nếu có (từ API),
    // hoặc bỏ qua nếu là static data (slug string)
    const items = this.cart.items().map(i => {
      const prod = i.product as any;
      // id có dạng 24-char hex (MongoDB ObjectId)
      const isObjectId = /^[a-f\d]{24}$/i.test(prod.id ?? '');
      return {
        ...(isObjectId ? { product: prod.id } : {}),
        productName:    i.product.name,
        productImage:   i.product.image,
        productPrice:   i.product.price,
        priceNumber:    i.product.priceNumber,
        quantity:       i.quantity,
        selectedOption: i.selectedOption ?? '',
      };
    });

    // Không gửi `user`: server lấy chủ đơn hàng từ token đăng nhập.
    const payload = {
      guestName:       this.guestName(),
      guestEmail:      this.guestEmail(),
      guestPhone:      this.guestPhone(),
      items,
      subtotal:        this.cart.subtotal(),
      discount:        this.voucherDiscount(),
      voucherCode:     this.selectedVoucher()?.code || null,
      shippingFee:     0,
      total:           this.finalTotal(),
      shippingMethod:  this.shippingMethod(),
      shippingAddress: this.shippingAddr(),
      paymentMethod:   this.paymentMethod(),
      estimatedPoints: this.estimatedPoints(),
    };

    this.orderApi.create(payload as any).subscribe({
      next: (res) => {
        this.submitting.set(false);
        this.orderCode.set(res.data.orderCode);
        this.completed.set(true);

        // Đồng bộ lại dữ liệu tài khoản từ server sau khi đặt hàng
        this.cart.loadUserData();

        // Voucher đã dùng được server đánh dấu → tải lại; điểm được cộng khi đơn giao thành công
        this.voucher.refreshMine();

        this.cart.clear();
      },
      error: (err) => {
        this.submitting.set(false);
        this.errorMsg.set(err.error?.message || 'Đặt hàng thất bại, vui lòng thử lại.');
      },
    });
  }
}
