import { Component, signal, inject, computed, effect, OnInit } from '@angular/core';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ShellComponent } from '../../components/shell/shell.component';
import { CartService, formatPrice, getCartItemKey } from '../../shared/services/cart.service';
import { OrderApiService } from '../../shared/services/order-api.service';
import { VoucherService } from '../../shared/services/voucher.service';
import { Voucher, XanhLaCartItem, EvaluatedCartItemPricing } from '../../shared/models/xanh-la.models';
import { ShippingMapPickerComponent } from '../../components/shipping-map-picker/shipping-map-picker.component';
import { ShippingCalculationResult } from '../../shared/services/shipping-api.service';

export interface CheckoutVoucherOption {
  voucher: Voucher;
  inWallet: boolean;
  isEligible: boolean;
  estimatedDiscount: number;
}

export interface NonRefundableItemSummary {
  name: string;
  categoryName: string;
  isCombo?: boolean;
}

// Nhận diện sản phẩm tươi sống thuộc 4 nhóm: Rau củ, Trái cây, Thịt, Cá & Hải sản
export function isFreshPerishableProduct(p: any): { isFresh: boolean; categoryName: string } {
  if (!p) return { isFresh: false, categoryName: '' };
  const cat = (p.category || '').toLowerCase();
  const catVi = (p.categoryVi || '').toLowerCase();
  const name = (p.name || '').toLowerCase();
  const combined = `${cat} ${catVi} ${name}`;

  // Loại trừ nhóm đồ uống, bánh kẹo, gia vị & đồ khô, sữa
  const excluded = [
    'beverages', 'thức uống', 'nước ép',
    'bakery', 'bánh mỳ', 'bánh ngọt',
    'pantry', 'gia vị', 'đồ khô', 'hạt & ngũ cốc',
    'dairy'
  ];
  if (excluded.some(ex => cat.includes(ex) || catVi.includes(ex))) {
    return { isFresh: false, categoryName: '' };
  }

  // 1. Rau củ
  if (/rau\s*củ|rau\s*ăn|rau\s*gia\s*vị|nấm\s*tươi|củ\s*quả|vegetable/i.test(combined)) {
    return { isFresh: true, categoryName: 'Rau củ tươi' };
  }
  // 2. Trái cây
  if (/trái\s*cây|hoa\s*quả|fruit/i.test(combined)) {
    return { isFresh: true, categoryName: 'Trái cây tươi' };
  }
  // 3. Thịt
  if (/thịt|meat|thịt\s*bò|thịt\s*heo|thịt\s*gà|gia\s*cầm/i.test(combined)) {
    return { isFresh: true, categoryName: 'Thịt tươi sống' };
  }
  // 4. Cá & hải sản
  if (/cá\s*&?\s*hải\s*sản|hải\s*sản|seafood|thủy\s*hải\s*sản/i.test(combined)) {
    return { isFresh: true, categoryName: 'Cá & hải sản tươi' };
  }

  return { isFresh: false, categoryName: '' };
}

@Component({
  selector: 'app-checkout',
  standalone: true,
  imports: [CommonModule, FormsModule, ShellComponent, RouterLink, ShippingMapPickerComponent],
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

  // VietQR & Chuyển khoản ngân hàng
  protected qrUrl        = signal<string | null>(null);
  protected createdTotal = signal<number>(0);
  protected bankInfo     = signal<{ bankId: string; accountNo: string; accountName: string } | null>(null);
  protected copiedField  = signal<string | null>(null);

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

  readonly originalSubtotal = computed(() => {
    return this.cart.selectedOriginalSubtotal();
  });

  readonly comboDiscount = computed(() => {
    return this.cart.selectedComboDiscount();
  });

  readonly addonDiscount = computed(() => {
    return this.cart.selectedAddonDiscount();
  });

  // Quy chế Hàng tươi sống không hỗ trợ Hủy / Đổi / Trả (Rau củ, Trái cây, Thịt, Cá & Hải sản)
  protected nonRefundableConfirmed = signal(false);
  protected showNonRefundableModal = signal(false);

  readonly nonRefundablePolicy = computed<{
    hasNonRefundableItems: boolean;
    items: NonRefundableItemSummary[];
  }>(() => {
    const items = this.checkoutItems();
    const freshList: NonRefundableItemSummary[] = [];

    for (const it of items) {
      const prod = it.product as any;
      if (!prod) continue;

      const isCombo = Boolean(prod.isCombo || it.isCombo || it.itemType === 'combo');

      if (isCombo && Array.isArray(prod.comboItems) && prod.comboItems.length > 0) {
        const comboCheck = isFreshPerishableProduct(prod);
        let comboIsFresh = comboCheck.isFresh;
        const subNames: string[] = [];
        for (const ci of prod.comboItems) {
          const subP = ci.product || ci;
          const subCheck = isFreshPerishableProduct(subP);
          if (subCheck.isFresh) {
            comboIsFresh = true;
            subNames.push(subP.name || ci.name || 'Thành phần tươi sống');
          }
        }
        if (comboIsFresh) {
          freshList.push({
            name: subNames.length > 0 ? `${prod.name} (thành phần: ${subNames.join(', ')})` : prod.name,
            categoryName: comboCheck.categoryName || 'Combo thực phẩm tươi sống',
            isCombo: true,
          });
        }
      } else {
        const check = isFreshPerishableProduct(prod);
        if (check.isFresh) {
          freshList.push({
            name: prod.name,
            categoryName: check.categoryName,
            isCombo: isCombo,
          });
        }
      }
    }

    return {
      hasNonRefundableItems: freshList.length > 0,
      items: freshList,
    };
  });

  protected itemKey = getCartItemKey;

  itemPricing(item: XanhLaCartItem): EvaluatedCartItemPricing {
    return this.cart.getItemPricing(item, 'selected');
  }

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

  // Vận chuyển & Bản đồ định vị
  protected shippingCoordinates = signal<{ lat: number; lng: number } | null>({ lat: 10.852, lng: 106.772 });
  protected shippingCalculation = signal<ShippingCalculationResult | null>(null);
  protected isOutOfRange = signal(false);
  protected outOfRangeMessage = signal('');

  // Phí ship thực tế (lấy từ kết quả tính toán backend theo khoảng cách OSRM)
  readonly shippingDistanceKm = computed(() => {
    return this.shippingCalculation()?.distanceKm ?? 0;
  });

  readonly estimatedDeliveryTime = computed(() => {
    return this.shippingCalculation()?.estimatedDeliveryTime ?? '';
  });

  readonly shippingUnsupported = computed(() => {
    return this.isOutOfRange() || (this.shippingCalculation() !== null && this.shippingCalculation()?.supported === false);
  });

  readonly shippingFee = computed(() => {
    if (this.shippingMethod() === 'pickup') return 0;
    return this.shippingCalculation()?.finalFee ?? 0;
  });

  readonly shippingDiscount = computed(() => {
    if (this.shippingMethod() === 'pickup') return 0;
    return this.shippingCalculation()?.discount ?? 0;
  });

  // Total sau giảm giá voucher + phí vận chuyển thực tế
  readonly finalTotal = computed(() => {
    return Math.max(0, this.checkoutSubtotal() - this.voucherDiscount() + this.shippingFee());
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

  onLocationChanged(event: { address: string; lat: number; lng: number; result: ShippingCalculationResult }): void {
    this.shippingAddr.set(event.address);
    this.shippingCoordinates.set({ lat: event.lat, lng: event.lng });
    this.shippingCalculation.set(event.result);
    this.isOutOfRange.set(false);
    this.outOfRangeMessage.set('');
  }

  onOutOfRange(event: { message: string; distanceKm: number }): void {
    this.isOutOfRange.set(true);
    this.outOfRangeMessage.set(event.message);
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
      this.errorMsg.set('Vui lòng chọn hoặc nhập địa chỉ giao hàng trên bản đồ.'); return;
    }

    if (this.shippingMethod() === 'delivery' && this.isOutOfRange()) {
      this.errorMsg.set(
        this.outOfRangeMessage() ||
          'Khu vực giao hàng vượt quá bán kính 10km cho phép đối với nông sản & thực phẩm mát. Vui lòng chọn điểm nhận hàng gần hơn hoặc chọn "Đến lấy trực tiếp".'
      );
      return;
    }

    // Nếu đơn hàng có sản phẩm tươi sống (Rau củ, Trái cây, Thịt, Cá & Hải sản) và người dùng chưa xác nhận quy chế
    // -> Bật modal popup cảnh báo để người dùng xác nhận trước khi đặt hàng
    if (this.nonRefundablePolicy().hasNonRefundableItems && !this.nonRefundableConfirmed()) {
      this.showNonRefundableModal.set(true);
      return;
    }

    this.executeOrderPlacement();
  }

  confirmNonRefundableAndPlaceOrder(): void {
    this.nonRefundableConfirmed.set(true);
    this.showNonRefundableModal.set(false);
    this.executeOrderPlacement();
  }

  closeNonRefundableModal(): void {
    this.showNonRefundableModal.set(false);
  }

  executeOrderPlacement(): void {
    const currentItems = this.checkoutItems();
    if (currentItems.length === 0) {
      this.errorMsg.set('Không có sản phẩm nào được chọn để thanh toán.'); return;
    }

    this.submitting.set(true);
    this.errorMsg.set('');

    // Build order payload — product field là MongoDB _id nếu có (từ API),
    // hoặc bỏ qua nếu là static data (slug string)
    const items = currentItems.map(i => {
      const prod = i.product as any;
      // id có dạng 24-char hex (MongoDB ObjectId)
      const isObjectId = /^[a-f\d]{24}$/i.test(prod.id ?? '');
      const itemType = i.product.isCombo
        ? 'combo'
        : (i.itemType === 'addon' ? 'addon' : 'regular');
      return {
        ...(isObjectId ? { product: prod.id } : { product: i.product.slug }),
        productName:       i.product.name,
        productImage:      i.product.image,
        productPrice:      i.product.price,
        priceNumber:       i.product.priceNumber,
        quantity:          i.quantity,
        selectedOption:    i.selectedOption ?? '',
        isCombo:           !!i.product.isCombo,
        itemType,
        linkedMainProduct: itemType === 'addon' ? (i.linkedMainProductId || i.linkedMainProductSlug || '') : '',
        comboItems:        i.product.comboItems || [],
      };
    });

    // Không gửi `user`: server lấy chủ đơn hàng từ token đăng nhập.
    const payload = {
      guestName:           this.guestName(),
      guestEmail:          this.guestEmail(),
      guestPhone:          this.guestPhone(),
      items,
      subtotal:            this.checkoutSubtotal(),
      comboDiscount:       this.comboDiscount(),
      addonDiscount:       this.addonDiscount(),
      discount:            this.voucherDiscount(),
      voucherCode:         this.selectedVoucher()?.code || null,
      shippingFee:         this.shippingFee(),
      shippingDiscount:    this.shippingDiscount(),
      shippingDistanceKm:  this.shippingCalculation()?.distanceKm || 0,
      shippingCoordinates: this.shippingCoordinates(),
      total:               this.finalTotal(),
      shippingMethod:      this.shippingMethod(),
      shippingAddress:     this.shippingAddr(),
      paymentMethod:       this.paymentMethod(),
      estimatedPoints:     this.estimatedPoints(),
      hasNonRefundableItems: this.nonRefundablePolicy().hasNonRefundableItems,
      nonRefundableAccepted: this.nonRefundableConfirmed(),
      nonRefundableItems:    this.nonRefundablePolicy().items,
    };

    this.orderApi.create(payload as any).subscribe({
      next: (res: any) => {
        this.submitting.set(false);
        const code = res.data?.orderCode || res.orderCode;
        const total = res.data?.total ?? res.total ?? this.finalTotal();
        const qr = res.data?.qrUrl || res.qrUrl || null;
        const bank = res.data?.bankInfo || (this.paymentMethod() === 'bank_transfer' ? {
          bankId: 'MB',
          accountNo: '0962299122',
          accountName: 'VY TAM NHU'
        } : null);

        this.orderCode.set(code);
        this.createdTotal.set(total);
        this.qrUrl.set(qr);
        this.bankInfo.set(bank);
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

  /** Sao chép thông tin (STK hoặc Nội dung CK) vào clipboard kèm thông báo */
  copyToClipboard(text: string, fieldName: string): void {
    if (!text) return;
    navigator.clipboard.writeText(text).then(() => {
      this.copiedField.set(fieldName);
      setTimeout(() => {
        if (this.copiedField() === fieldName) {
          this.copiedField.set(null);
        }
      }, 2000);
    }).catch(() => {
      this.copiedField.set(fieldName);
      setTimeout(() => this.copiedField.set(null), 2000);
    });
  }

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
