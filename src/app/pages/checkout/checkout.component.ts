import { Component, signal, inject, computed, effect, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ShellComponent } from '../../components/shell/shell.component';
import { CartService, formatPrice } from '../../shared/services/cart.service';
import { OrderApiService } from '../../shared/services/order-api.service';
import { VoucherService } from '../../shared/services/voucher.service';
import { Voucher } from '../../shared/models/xanh-la.models';

export interface CheckoutVoucherOption {
  voucher: Voucher;
  inWallet: boolean;
  isEligible: boolean;
  estimatedDiscount: number;
}

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, FormsModule, ShellComponent, RouterLink],
  templateUrl: './checkout.component.html',
  styleUrl: './checkout.component.css',
})
export class CheckoutComponent implements OnInit {
  protected cart     = inject(CartService);
  private orderApi   = inject(OrderApiService);
  private router     = inject(Router);
  private route      = inject(ActivatedRoute);
  protected voucher  = inject(VoucherService);
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
  protected showVoucherPicker = signal(false);
  private pendingQueryVoucher = signal('');

  // Chỉ thanh toán các món được chọn trong giỏ hàng
  readonly checkoutItems = computed(() => {
    return this.cart.selectedItems();
  });

  readonly checkoutSubtotal = computed(() => {
    return this.cart.selectedSubtotal();
  });

  /** Danh sách ưu đãi để chọn trực tiếp khi thanh toán (gồm Ví voucher + ưu đãi công khai từ MongoDB). */
  readonly checkoutVoucherOptions = computed<CheckoutVoucherOption[]>(() => {
    const sub = this.checkoutSubtotal();
    const walletSet = new Set(this.voucher.availableVouchers().map(uv => uv.voucher.code.toUpperCase()));
    const byCode = new Map<string, Voucher>();

    for (const uv of this.voucher.availableVouchers()) {
      byCode.set(uv.voucher.code.toUpperCase(), uv.voucher);
    }
    for (const pub of this.voucher.publicVouchers()) {
      const k = pub.code.toUpperCase();
      if (!byCode.has(k)) byCode.set(k, pub);
    }

    return Array.from(byCode.values())
      .map((v) => {
        const minVal = v.minValue || 0;
        const isEligible = sub >= minVal && sub > 0;
        let disc = v.type === 'percentage' ? Math.floor((sub * v.value) / 100) : v.value;
        if (v.type === 'percentage' && v.maxValue) {
          disc = Math.min(disc, v.maxValue);
        }
        disc = isEligible ? Math.max(0, Math.min(disc, sub)) : 0;
        return {
          voucher: v,
          inWallet: walletSet.has(v.code.toUpperCase()),
          isEligible,
          estimatedDiscount: disc,
        };
      })
      .sort((a, b) => {
        if (a.isEligible !== b.isEligible) return a.isEligible ? -1 : 1;
        if (a.inWallet !== b.inWallet) return a.inWallet ? -1 : 1;
        return b.estimatedDiscount - a.estimatedDiscount;
      });
  });

  // Loyalty points estimate
  readonly estimatedPoints = computed(() => {
    return Math.floor(this.checkoutSubtotal() / 1000); // 1 điểm cho mỗi 1000đ
  });

  // Total after discount
  readonly finalTotal = computed(() => {
    return Math.max(0, this.checkoutSubtotal() - this.voucherDiscount());
  });

  // form fields
  protected guestName    = signal(this.cart.currentUser()?.name  ?? '');
  protected guestPhone   = signal(this.cart.currentUser()?.phone ?? '');
  protected guestEmail   = signal(this.cart.currentUser()?.email ?? '');
  protected shippingAddr = signal(this._defaultAddress());

  constructor() {
    effect(() => {
      const code = this.pendingQueryVoucher();
      const subtotal = this.checkoutSubtotal();
      if (code && subtotal > 0) {
        this.pendingQueryVoucher.set('');
        this.applyVoucher();
      }
    });

    effect(() => {
      const u = this.cart.currentUser();
      if (u) {
        this.guestName.set(u.name || '');
        this.guestEmail.set(u.email || '');
        this.guestPhone.set(u.phone || '');
        this.shippingAddr.set(this._defaultAddress());
      }
    });
  }

  ngOnInit(): void {
    this.voucher.loadPublic();
    this.voucher.refreshMine();
    const qCode = this.route.snapshot.queryParamMap.get('voucher');
    if (qCode) {
      const code = qCode.trim().toUpperCase();
      this.voucherCode.set(code);
      this.pendingQueryVoucher.set(code);
    }
  }

  /** Địa chỉ mặc định của tài khoản đang đăng nhập (để điền sẵn khi giao hàng). */
  private _defaultAddress(): string {
    const addrs = this.cart.currentUser()?.addresses ?? [];
    const a = addrs.find((x) => x.isDefault) ?? addrs[0];
    return a ? [a.address, a.city].filter(Boolean).join(', ') : '';
  }

  onSelectVoucherDropdown(code: string): void {
    if (!code) {
      this.removeVoucher();
      return;
    }
    this.voucherCode.set(code);
    this.applyVoucher();
  }

  selectOfferCode(code: string): void {
    this.voucherCode.set(code);
    this.applyVoucher();
  }

  applyVoucher(): void {
    const code = this.voucherCode().trim().toUpperCase();
    if (!code) {
      this.voucherMessage.set('Vui lòng nhập hoặc chọn mã voucher');
      return;
    }
    this.voucherCode.set(code);

    this.voucher.validateVoucher(code, this.checkoutSubtotal()).subscribe((result) => {
      if (result.valid) {
        this.selectedVoucher.set({ code, discount: result.discount });
        this.voucherDiscount.set(result.discount);
        this.voucherMessage.set(`Đã áp dụng mã ${code}: Giảm ${formatPrice(result.discount)}`);
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

    const currentItems = this.checkoutItems();
    if (currentItems.length === 0) {
      this.errorMsg.set('Không có sản phẩm nào được chọn để thanh toán.'); return;
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
    const items = currentItems.map(i => {
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
      subtotal:        this.checkoutSubtotal(),
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

        this.cart.removeSelectedItems();
      },
      error: (err) => {
        this.submitting.set(false);
        this.errorMsg.set(err.error?.message || 'Đặt hàng thất bại, vui lòng thử lại.');
      },
    });
  }
}
