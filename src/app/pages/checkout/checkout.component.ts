import { ChangeDetectionStrategy, Component, signal, inject, computed, OnInit, effect } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ShellComponent } from '../../components/shell/shell.component';
import { CartService, formatPrice } from '../../shared/services/cart.service';
import { OrderApiService } from '../../shared/services/order-api.service';
import { CheckoutVoucherRecord, VoucherService } from '../../shared/services/voucher.service';
import { LoyaltyService } from '../../shared/services/loyalty.service';

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, FormsModule, ShellComponent, RouterLink],
  templateUrl: './checkout.component.html',
  styleUrl: './checkout.component.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CheckoutComponent implements OnInit {
  protected cart     = inject(CartService);
  private orderApi   = inject(OrderApiService);
  private router     = inject(Router);
  private route      = inject(ActivatedRoute);
  private voucher    = inject(VoucherService);
  private loyalty    = inject(LoyaltyService);
  protected formatPrice = formatPrice;

  protected completed      = signal(false);
  protected orderCode      = signal('');
  protected submitting     = signal(false);
  protected errorMsg       = signal('');
  protected shippingMethod = signal<'pickup' | 'delivery'>('pickup');
  protected paymentMethod  = signal<'cod' | 'bank_transfer'>('cod');

  // Voucher state
  protected voucherCode = signal('');
  protected selectedVoucher = signal<{ code: string; name?: string; discount: number } | null>(null);
  protected voucherDiscount = signal(0);
  protected voucherMessage = signal('');
  protected savedVouchers = signal<CheckoutVoucherRecord[]>([]);
  protected vouchersLoading = signal(false);
  protected showOfferList = signal(true);
  private loadedVoucherContext = '';

  constructor() {
    effect(() => {
      this.cart.currentUser();
      const orderTotal = this.cart.subtotal();
      const token = typeof localStorage !== 'undefined' ? (localStorage.getItem('xanhla_auth_token') || 'guest') : 'guest';
      const context = `${token}:${orderTotal}`;
      if (context !== this.loadedVoucherContext) {
        this.loadedVoucherContext = context;
        this.loadAvailableVouchers(orderTotal);
      }
    });
  }

  ngOnInit(): void {
    this.route.queryParamMap.subscribe(params => {
      const code = params.get('voucher');
      if (code) {
        this.voucherCode.set(code.trim().toUpperCase());
        this.applyVoucher();
      }
    });
  }

  private loadAvailableVouchers(orderTotal: number): void {
    this.vouchersLoading.set(true);
    this.voucher.getAvailableForCheckout(orderTotal).subscribe({
      next: response => {
        this.savedVouchers.set(response.data ?? []);
        this.vouchersLoading.set(false);

        // Re-validate currently selected voucher if subtotal changed
        const current = this.selectedVoucher();
        if (current?.code) {
          const matched = (response.data ?? []).find(v => v.code === current.code);
          if (matched && matched.canApply) {
            this.voucherDiscount.set(matched.discountAmount);
            this.selectedVoucher.set({ code: matched.code, name: matched.name, discount: matched.discountAmount });
          } else if (matched && !matched.canApply) {
            this.removeVoucher();
            this.voucherMessage.set(`Đơn hàng tối thiểu ${formatPrice(matched.minOrderValue)} để áp dụng mã ${matched.code}`);
          }
        }
      },
      error: () => {
        this.savedVouchers.set([]);
        this.vouchersLoading.set(false);
      },
    });
  }

  chooseSavedVoucher(code: string): void {
    if (!code) {
      this.removeVoucher();
      return;
    }
    this.voucherCode.set(code.trim().toUpperCase());
    this.applyVoucher();
  }

  toggleOfferList(): void {
    this.showOfferList.update(v => !v);
  }

  // Loyalty points estimate
  readonly estimatedPoints = computed(() => {
    const subtotal = this.cart.subtotal();
    return Math.floor(subtotal / 1000);
  });

  // Total after discount
  readonly finalTotal = computed(() => {
    return Math.max(0, this.cart.subtotal() - this.voucherDiscount());
  });

  // form fields
  protected guestName    = signal(this.cart.currentUser()?.name  ?? '');
  protected guestPhone   = signal('');
  protected guestEmail   = signal(this.cart.currentUser()?.email ?? '');
  protected shippingAddr = signal('');

  applyVoucher(): void {
    const code = this.voucherCode().trim().toUpperCase();
    if (!code) {
      this.voucherMessage.set('Vui lòng nhập hoặc chọn mã voucher');
      return;
    }
    this.voucherCode.set(code);

    this.voucher.validateVoucher(code, this.cart.subtotal()).subscribe({
      next: response => {
        const applied = response.data;
        this.selectedVoucher.set({
          code: applied.code,
          name: applied.name,
          discount: applied.discountAmount,
        });
        this.voucherDiscount.set(applied.discountAmount);
        this.voucherMessage.set(`Đã áp dụng mã ${applied.code} (${applied.name}): Giảm ${formatPrice(applied.discountAmount)}`);
      },
      error: err => {
        this.selectedVoucher.set(null);
        this.voucherDiscount.set(0);
        this.voucherMessage.set(err.error?.message || 'Mã voucher không hợp lệ hoặc chưa đủ điều kiện');
      },
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

    const items = this.cart.items().map(i => {
      const prod = i.product as any;
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

    const user = this.cart.currentUser();
    const payload = {
      ...(user ? { user: (user as any)._id || (user as any).id } : {}),
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

        const user = this.cart.currentUser();
        if (user) {
          this.loyalty.addPoints(user.email, this.estimatedPoints(), 'Tích điểm từ đơn hàng');
        }

        this.cart.clear();
      },
      error: (err) => {
        this.submitting.set(false);
        this.errorMsg.set(err.error?.message || 'Đặt hàng thất bại, vui lòng thử lại.');
      },
    });
  }
}
