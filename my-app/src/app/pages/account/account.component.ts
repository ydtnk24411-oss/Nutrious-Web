import { Component, signal, inject, OnInit, computed, HostListener, effect, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterLink, ActivatedRoute } from '@angular/router';
import { OrderApiService } from '../../shared/services/order-api.service';
import { ShellComponent } from '../../components/shell/shell.component';
import { CartService } from '../../shared/services/cart.service';
import { GoogleAuthService } from '../../shared/services/google-auth.service';
import { LoyaltyService } from '../../shared/services/loyalty.service';
import { VoucherService } from '../../shared/services/voucher.service';
import { XanhLaAddress, XanhLaProduct } from '../../shared/models/xanh-la.models';
import {
  AddressPickerModalComponent,
  AddressPickerResult,
} from '../../components/address-picker-modal/address-picker-modal.component';
import { WishlistService } from '../../shared/services/wishlist.service';
import { buildVoucherVisual, formatVoucherDateVi } from '../../shared/utils/voucher-visual.util';

type Tab = 'overview' | 'orders' | 'addresses' | 'vouchers' | 'wishlist' | 'settings';

@Component({
  selector: 'app-account',
  standalone: true,
  imports: [CommonModule, FormsModule, ShellComponent, RouterLink, AddressPickerModalComponent],
  templateUrl: './account.component.html',
  styleUrl: './account.component.css',
})
export class AccountComponent implements OnInit, OnDestroy {
  protected cart       = inject(CartService);
  protected wishlist   = inject(WishlistService);
  protected googleAuth = inject(GoogleAuthService);
  protected router     = inject(Router);
  protected voucher    = inject(VoucherService);
  private loyalty      = inject(LoyaltyService);
  private route        = inject(ActivatedRoute);
  private orderApi     = inject(OrderApiService);

  constructor() {
    effect(() => {
      const u = this.cart.currentUser();
      if (u) {
        this.displayName.set(u.name ?? '');
        this.firstName.set(u.firstName ?? '');
        this.lastName.set(u.lastName ?? '');
        this.phone.set(u.phone ?? '');
        this.title.set(u.title ?? '');
        this.gender.set(u.gender ?? '');
        this.birthday.set(u.birthday ?? '');
      }
    });
  }

  // ── Tab & Inline Edit ────────────────────────
  activeTab = signal<Tab>('overview');
  editingOverviewProfile = signal(false);

  // ── My Account form ──────────────────────────
  displayName = signal('');
  firstName   = signal('');
  lastName    = signal('');
  phone       = signal('');
  title       = signal('');
  gender      = signal('');
  birthday    = signal('');
  avatar      = signal('');
  saved       = signal(false);
  saving      = signal(false);
  uploadingAvatar = signal(false);
  avatarMenuOpen = signal(false);

  // ── My Addresses ─────────────────────────────
  showAddressModal = signal(false);
  editingAddress = signal<Partial<XanhLaAddress> | null>(null);

  // ── Order History ────────────────────────────
  orders = signal<any[]>([]);
  loadingOrders = signal(false);

  orderStatusFilter = signal<'all' | 'pending' | 'processing' | 'delivering' | 'completed' | 'cancelled'>('all');
  orderSearchQuery = signal('');
  orderPage = signal(1);
  orderPageSize = signal(5);

  filteredOrders = computed(() => {
    const statusFilter = this.orderStatusFilter();
    const searchQuery = this.orderSearchQuery().toLowerCase();

    return this.orders().filter(order => {
      let matchesStatus = false;
      if (statusFilter === 'all') {
        matchesStatus = true;
      } else if (statusFilter === 'processing') {
        matchesStatus = ['processing', 'confirmed', 'preparing'].includes(order.status);
      } else if (statusFilter === 'delivering') {
        matchesStatus = ['delivering', 'shipping'].includes(order.status);
      } else if (statusFilter === 'completed') {
        matchesStatus = ['completed', 'delivered'].includes(order.status);
      } else {
        matchesStatus = order.status === statusFilter;
      }

      const matchesSearch = searchQuery === '' || (order.orderCode && order.orderCode.toLowerCase().includes(searchQuery));
      return matchesStatus && matchesSearch;
    });
  });

  orderTotalPages = computed(() => Math.ceil(this.filteredOrders().length / this.orderPageSize()) || 1);
  paginatedOrders = computed(() => {
    const list = this.filteredOrders();
    const start = (this.orderPage() - 1) * this.orderPageSize();
    return list.slice(start, start + this.orderPageSize());
  });

  prevOrderPage(): void {
    if (this.orderPage() > 1) this.orderPage.update(p => p - 1);
  }

  nextOrderPage(): void {
    if (this.orderPage() < this.orderTotalPages()) this.orderPage.update(p => p + 1);
  }

  onOrderFilterChange(): void {
    this.orderPage.set(1);
  }

  // ── Loyalty & Points ────────────────────────
  readonly userPoints = computed(() => {
    const user = this.cart.currentUser();
    return user ? this.loyalty.getUserBalance(user.email) : 0;
  });

  readonly userTier = computed(() => {
    const user = this.cart.currentUser();
    if (!user) return this.loyalty.tierConfigs[0];
    return this.loyalty.getUserTier(
      this.userPoints(),
      user.totalSpent || 0
    );
  });

  readonly pointTransactions = computed(() => {
    const user = this.cart.currentUser();
    return user ? this.loyalty.getUserTransactions(user.email) : [];
  });

  readonly userVouchers = this.voucher.availableVouchers;

  readonly userVoucherViews = computed(() =>
    this.userVouchers().map((uv, idx) => ({
      uv,
      visual: buildVoucherVisual(uv.voucher, idx),
      endDate: formatVoucherDateVi(uv.voucher.endDate),
    }))
  );

  readonly availableRewards = computed(() => {
    return this.loyalty.getAvailableRewards();
  });

  readonly defaultAddressText = computed(() => {
    const addrs = this.cart.currentUser()?.addresses ?? [];
    if (addrs.length === 0) return '';
    const addr = addrs.find(a => a.isDefault) || addrs[0];
    if (!addr) return '';
    const cityNeeded = addr.city && !this.isCityIncludedInAddress(addr);
    return cityNeeded ? `${addr.address}, ${addr.city}` : addr.address;
  });

  readonly bannerProduceImg = signal<string>('/account-banner-produce.jpg');

  onBannerImageError(): void {
    if (this.bannerProduceImg() !== 'https://images.unsplash.com/photo-1542838132-92c53300491e?w=600&q=80') {
      this.bannerProduceImg.set('https://images.unsplash.com/photo-1542838132-92c53300491e?w=600&q=80');
    }
  }

  ngOnInit(): void {
    const u = this.cart.currentUser();
    if (!u) { this.router.navigate(['/']); return; }
    this.syncProfileSignals(u);

    this.route.queryParams.subscribe(params => {
      const tab = params['tab'];
      if (tab && ['overview', 'orders', 'addresses', 'vouchers', 'wishlist', 'settings'].includes(tab)) {
        this.activeTab.set(tab as Tab);
      }
    });

    this.cart.loadUserData();
    this.loyalty.refresh();
    this.voucher.refreshMine();
    this.loadOrders();
  }

  private syncProfileSignals(u: any): void {
    this.displayName.set(u.name ?? '');
    this.firstName.set(u.firstName ?? '');
    this.lastName.set(u.lastName ?? '');
    this.phone.set(u.phone ?? '');
    this.title.set(u.title ?? '');
    this.gender.set(u.gender ?? '');
    this.birthday.set(u.birthday ?? '');
  }

  selectTab(tab: Tab): void {
    this.activeTab.set(tab);
    this.editingOverviewProfile.set(false);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }

  // ── Load Orders ──────────────────────────────
  loadOrders(): void {
    this.loadingOrders.set(true);
    this.orderApi.getMyOrders().subscribe({
      next: (res) => {
        this.loadingOrders.set(false);
        if (res?.data) {
          this.orders.set(res.data.map((order: any) => {
            const dt = order.createdAt ? new Date(order.createdAt) : null;
            const dateStr = dt ? dt.toLocaleDateString('vi-VN') : '';
            const timeStr = dt
              ? `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`
              : '';
            const dateTime = timeStr && dateStr ? `${timeStr} - ${dateStr}` : dateStr;

            return {
              id: order._id,
              _id: order._id,
              orderCode: order.orderCode,
              date: dateStr,
              dateTime,
              createdAt: order.createdAt,
              total: order.total,
              status: order.status,
              storeName: order.storeName || 'EvergreenMart',
              items: (order.items || []).map((item: any) => ({
                productId: typeof item.product === 'string' ? item.product : (item.product?._id || ''),
                name: item.productName || item.name || 'Sản phẩm',
                productName: item.productName || item.name || 'Sản phẩm',
                image: item.productImage || item.image || item.product?.image || '',
                selectedOption: item.selectedOption || '',
                isCombo: Boolean(item.isCombo || (Array.isArray(item.comboItems) && item.comboItems.length > 0)),
                quantity: item.quantity || 1,
                price: item.priceNumber ?? (typeof item.productPrice === 'number' ? item.productPrice : Number(String(item.productPrice || 0).replace(/[^\d]/g, ''))),
              })),
            };
          }));
        }
      },
      error: (err) => {
        this.loadingOrders.set(false);
        console.error('Failed to load user orders:', err);
      }
    });
  }

  readonly fallbackOrderImage = '/evergreen-logo.png';

  onOrderImageError(event: Event): void {
    const img = event.target as HTMLImageElement | null;
    if (img && !img.dataset['fallbackApplied']) {
      img.dataset['fallbackApplied'] = '1';
      img.src = this.fallbackOrderImage;
    }
  }

  reorderOrder(order: any): void {
    if (!order?.items?.length) return;
    for (const item of order.items) {
      const prod: XanhLaProduct = {
        id: item.productId || item.name,
        name: item.name,
        slug: item.productId || item.name,
        price: this.formatPrice(item.price || 0),
        priceNumber: item.price || 0,
        image: item.image || this.fallbackOrderImage,
        category: '',
        categoryVi: '',
        description: '',
        container: '',
        cutType: '',
        cutting: '',
        packSize: '',
        packaging: '',
        preparation: '',
        quantity: '',
        ripeness: '',
        sizeGroup: '',
        thickness: '',
        type: '',
        weight: '',
        isCombo: Boolean(item.isCombo),
      };
      this.cart.addItem(prod, item.quantity || 1, item.selectedOption || undefined);
    }
    this.cart.openCartDrawer();
  }

  formatStatCount(n: number): string {
    const val = Number(n) || 0;
    if (val >= 0 && val < 10) return `0${val}`;
    return val.toLocaleString('vi-VN');
  }

  formatBirthdayDisplay(raw?: string): string {
    const text = String(raw || '').trim();
    if (!text) return '';
    if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
      const [y, m, d] = text.split('-');
      return `${d}/${m}/${y}`;
    }
    return text;
  }

  addWishlistItemToCart(item: any): void {
    const p = {
      ...item,
      id: item.id || item._id,
      rating: item.rating ?? 5,
      soldCount: item.soldCount ?? 0,
      tags: item.tags || [],
    };
    this.cart.addItem(p as any, 1);
  }

  // ── Save account info ────────────────────────
  saveAccount(e: Event): void {
    e.preventDefault();
    this.saving.set(true);
    const fullName = this.displayName().trim() || [this.firstName(), this.lastName()].filter(Boolean).join(' ').trim();
    const updateData = {
      name:      fullName,
      firstName: this.firstName(),
      lastName:  this.lastName(),
      title:     this.title(),
      gender:    this.gender(),
      birthday:  this.birthday(),
      avatar:    this.cart.currentUser()?.avatar ?? '',
    };
    this.cart.updateUser(updateData);
    setTimeout(() => {
      this.saving.set(false);
      this.saved.set(true);
      this.editingOverviewProfile.set(false);
      setTimeout(() => this.saved.set(false), 3000);
    }, 350);
  }

  // ── Upload Avatar ────────────────────────────
  onAvatarUpload(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      alert('Kích thước ảnh không được vượt quá 2MB');
      return;
    }
    if (!file.type.startsWith('image/')) {
      alert('Vui lòng chọn file ảnh');
      return;
    }

    this.uploadingAvatar.set(true);
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      this.uploadingAvatar.set(false);
      this.avatarMenuOpen.set(false);
      this.cart.updateUser({ avatar: base64 });
    };
    reader.onerror = () => {
      alert('Không thể đọc file ảnh');
      this.uploadingAvatar.set(false);
    };
    reader.readAsDataURL(file);
  }

  removeAvatar(): void {
    if (confirm('Bạn có chắc muốn xóa ảnh đại diện?')) {
      this.avatarMenuOpen.set(false);
      this.cart.updateUser({ avatar: '' });
    }
  }

  toggleAvatarMenu(): void {
    this.avatarMenuOpen.update(v => !v);
  }

  cancelAccount(): void {
    const u = this.cart.currentUser();
    if (!u) return;
    this.syncProfileSignals(u);
    this.editingOverviewProfile.set(false);
  }

  // ── Addresses ────────────────────────────────
  openAddAddressModal(): void {
    this.editingAddress.set(null);
    this.showAddressModal.set(true);
  }

  editAddress(id: string): void {
    const addr = this.cart.currentUser()?.addresses?.find(a => a.id === id);
    if (!addr) return;
    this.editingAddress.set({ ...addr });
    this.showAddressModal.set(true);
  }

  closeAddressModal(): void {
    this.showAddressModal.set(false);
    this.editingAddress.set(null);
  }

  onAddressPickerConfirmed(res: AddressPickerResult): void {
    const editing = this.editingAddress();
    const addr: XanhLaAddress = {
      id:           editing?.id || ('addr_' + Date.now()),
      label:        res.label || 'Nhà riêng',
      fullName:     res.receiverName,
      phone:        res.receiverPhone,
      address:      res.fullAddress,
      city:         res.provinceName,
      province:     res.provinceName,
      provinceCode: res.provinceCode,
      ward:         res.wardName,
      wardCode:     res.wardCode,
      street:       res.street,
      lat:          res.lat,
      lng:          res.lng,
      isDefault:    res.isDefault,
    };

    if (editing?.id) {
      this.cart.updateAddress(addr);
    } else {
      this.cart.addAddress(addr);
    }
    this.closeAddressModal();
  }

  isCityIncludedInAddress(addr: XanhLaAddress): boolean {
    if (!addr.city || !addr.address) return false;
    return addr.address.toLowerCase().includes(addr.city.toLowerCase());
  }

  removeAddress(id: string): void {
    if (confirm('Xóa địa chỉ này?')) this.cart.removeAddress(id);
  }

  setDefault(id: string): void {
    const addrs = (this.cart.currentUser()?.addresses ?? []).map(a => ({
      ...a, isDefault: a.id === id,
    }));
    this.cart.updateUser({ addresses: addrs });
  }

  // ── Orders ─────────────────────────────────
  getOrderStatusText(status: string): string {
    const statusMap: Record<string, string> = {
      pending: 'Chờ xác nhận',
      confirmed: 'Đã xác nhận',
      processing: 'Đang xử lý',
      preparing: 'Đang chuẩn bị',
      shipping: 'Đang giao hàng',
      delivering: 'Đang giao hàng',
      delivered: 'Đã giao hàng',
      completed: 'Đã giao hàng',
      cancelled: 'Đã hủy',
      returned: 'Đã hoàn trả',
    };
    return statusMap[status] || status;
  }

  getOrderStatusClass(status: string): string {
    const classMap: Record<string, string> = {
      pending: 'status-pending',
      confirmed: 'status-confirmed',
      processing: 'status-preparing',
      preparing: 'status-preparing',
      shipping: 'status-shipping',
      delivering: 'status-shipping',
      delivered: 'status-delivered',
      completed: 'status-delivered',
      cancelled: 'status-cancelled',
      returned: 'status-returned',
    };
    return classMap[status] || '';
  }

  isCompletedOrder(status: string): boolean {
    return ['completed', 'delivered'].includes(status);
  }

  isActiveOrder(status: string): boolean {
    return ['pending', 'confirmed', 'processing', 'preparing', 'shipping', 'delivering'].includes(status);
  }

  // ── Logout ───────────────────────────────────
  logout(): void {
    this.cart.logout();
    this.router.navigate(['/']);
  }

  // ── Utils ────────────────────────────────────
  avatarChar(): string {
    return (this.cart.currentUser()?.name ?? 'U').charAt(0).toUpperCase();
  }

  openForgotPasswordModal(): void {
    this.cart.openAuthModal('forgot');
  }

  formatPrice(value: number): string {
    return (value || 0).toLocaleString('vi-VN') + 'đ';
  }

  @HostListener('document:click', ['$event'])
  onDocClick(e: Event): void {
    const t = e.target as HTMLElement;
    if (!t.closest('.acc-avatar-menu') && !t.closest('.acc-avatar-edit-btn')) {
      this.avatarMenuOpen.set(false);
    }
  }

  // ── Đổi số điện thoại (Change Phone Number) ──
  showChangePhoneModal = signal(false);
  changePhoneInputsUnlocked = signal(false);
  changePhoneStep = signal<'input' | 'otp'>('input');
  newPhoneInput = signal('');
  changePhonePassword = signal('');
  changePhoneOtpDigits = signal<string[]>(['', '', '', '', '', '']);
  changePhoneLoading = signal(false);
  changePhoneError = signal('');
  changePhoneSuccess = signal('');
  changePhoneCountdown = signal(60);
  changePhoneCanResend = signal(false);
  changePhoneDemoOtp = signal('123456');
  private phoneCountdownInterval: any = null;

  // ── Liên kết tài khoản Google ────────────────
  googleLinkingLoading = signal(false);
  googleActionError = signal('');
  googleActionSuccess = signal('');

  // ── Hủy liên kết Google ─────────────────────
  showUnlinkModal = signal(false);
  unlinkPassword = signal('');
  unlinkLoading = signal(false);
  unlinkError = signal('');

  ngOnDestroy(): void {
    if (this.phoneCountdownInterval) {
      clearInterval(this.phoneCountdownInterval);
    }
  }

  openChangePhoneModal(): void {
    this.changePhoneInputsUnlocked.set(false);
    this.newPhoneInput.set('');
    this.changePhonePassword.set('');
    this.changePhoneOtpDigits.set(['', '', '', '', '', '']);
    this.changePhoneError.set('');
    this.changePhoneSuccess.set('');
    this.changePhoneStep.set('input');
    this.showChangePhoneModal.set(true);
  }

  closeChangePhoneModal(): void {
    this.showChangePhoneModal.set(false);
    if (this.phoneCountdownInterval) {
      clearInterval(this.phoneCountdownInterval);
    }
  }

  submitChangePhoneRequest(e: Event): void {
    e.preventDefault();
    this.changePhoneError.set('');
    const newPhone = this.newPhoneInput().trim();
    const password = this.changePhonePassword();

    if (!newPhone) {
      this.changePhoneError.set('Vui lòng nhập số điện thoại mới.');
      return;
    }
    if (!password) {
      this.changePhoneError.set('Vui lòng nhập mật khẩu tài khoản hiện tại.');
      return;
    }

    this.changePhoneLoading.set(true);
    this.cart.requestChangePhoneOtp(
      newPhone,
      password,
      (res) => {
        this.changePhoneLoading.set(false);
        if (res.demoOtp) {
          this.changePhoneDemoOtp.set(res.demoOtp);
        }
        this.changePhoneStep.set('otp');
        this.changePhoneOtpDigits.set(['', '', '', '', '', '']);
        this.startPhoneCountdown();
        setTimeout(() => this.focusPhoneOtp(0), 100);
      },
      (errMsg) => {
        this.changePhoneLoading.set(false);
        this.changePhoneError.set(errMsg);
      }
    );
  }

  submitChangePhoneVerify(e?: Event): void {
    if (e) e.preventDefault();
    this.changePhoneError.set('');
    const otp = this.changePhoneOtpDigits().join('');
    if (otp.length !== 6) {
      this.changePhoneError.set('Vui lòng nhập đủ 6 chữ số mã OTP.');
      return;
    }

    this.changePhoneLoading.set(true);
    this.cart.verifyChangePhoneOtp(
      this.newPhoneInput().trim(),
      otp,
      (updatedUser) => {
        this.changePhoneLoading.set(false);
        this.phone.set(updatedUser.phone || '');
        this.changePhoneSuccess.set('Cập nhật số điện thoại thành công!');
        if (this.phoneCountdownInterval) clearInterval(this.phoneCountdownInterval);
        setTimeout(() => {
          this.closeChangePhoneModal();
          this.changePhoneSuccess.set('');
        }, 1500);
      },
      (errMsg) => {
        this.changePhoneLoading.set(false);
        this.changePhoneError.set(errMsg);
      }
    );
  }

  resendChangePhoneOtp(): void {
    if (!this.changePhoneCanResend()) return;
    this.changePhoneError.set('');
    const newPhone = this.newPhoneInput().trim();
    const password = this.changePhonePassword();

    this.cart.requestChangePhoneOtp(
      newPhone,
      password,
      (res) => {
        if (res.demoOtp) this.changePhoneDemoOtp.set(res.demoOtp);
        this.startPhoneCountdown();
        this.changePhoneOtpDigits.set(['', '', '', '', '', '']);
        setTimeout(() => this.focusPhoneOtp(0), 100);
      },
      (errMsg) => {
        this.changePhoneError.set(errMsg);
      }
    );
  }

  onPhoneOtpInput(index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const val = input.value.replace(/[^0-9]/g, '');
    const current = [...this.changePhoneOtpDigits()];
    if (val) {
      current[index] = val.slice(-1);
      this.changePhoneOtpDigits.set(current);
      if (index < 5) {
        this.focusPhoneOtp(index + 1);
      } else if (current.join('').length === 6) {
        this.submitChangePhoneVerify();
      }
    } else {
      current[index] = '';
      this.changePhoneOtpDigits.set(current);
    }
  }

  onPhoneOtpKeyDown(index: number, event: KeyboardEvent): void {
    if (event.key === 'Backspace') {
      const current = [...this.changePhoneOtpDigits()];
      if (!current[index] && index > 0) {
        current[index - 1] = '';
        this.changePhoneOtpDigits.set(current);
        this.focusPhoneOtp(index - 1);
        event.preventDefault();
      } else {
        current[index] = '';
        this.changePhoneOtpDigits.set(current);
      }
    } else if (event.key === 'ArrowLeft' && index > 0) {
      this.focusPhoneOtp(index - 1);
    } else if (event.key === 'ArrowRight' && index < 5) {
      this.focusPhoneOtp(index + 1);
    }
  }

  onPhoneOtpPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const pasted = event.clipboardData?.getData('text') || '';
    const digits = pasted.replace(/[^0-9]/g, '').slice(0, 6).split('');
    if (digits.length > 0) {
      const current = ['', '', '', '', '', ''];
      for (let i = 0; i < digits.length; i++) current[i] = digits[i];
      this.changePhoneOtpDigits.set(current);
      if (digits.length === 6) {
        this.focusPhoneOtp(5);
        this.submitChangePhoneVerify();
      } else {
        this.focusPhoneOtp(digits.length);
      }
    }
  }

  private focusPhoneOtp(index: number): void {
    const el = document.getElementById(`phone-otp-${index}`) as HTMLInputElement;
    if (el) {
      el.focus();
      el.select();
    }
  }

  private startPhoneCountdown(): void {
    if (this.phoneCountdownInterval) clearInterval(this.phoneCountdownInterval);
    this.changePhoneCountdown.set(60);
    this.changePhoneCanResend.set(false);
    this.phoneCountdownInterval = setInterval(() => {
      const cur = this.changePhoneCountdown();
      if (cur <= 1) {
        this.changePhoneCountdown.set(0);
        this.changePhoneCanResend.set(true);
        clearInterval(this.phoneCountdownInterval);
      } else {
        this.changePhoneCountdown.set(cur - 1);
      }
    }, 1000);
  }

  // ── Liên kết tài khoản Google ────────────────
  handleLinkGoogle(): void {
    this.googleActionError.set('');
    this.googleActionSuccess.set('');
    this.googleLinkingLoading.set(true);

    this.googleAuth.promptSignIn(
      (tokenData) => {
        this.cart.linkGoogleAccount(
          tokenData,
          () => {
            this.googleLinkingLoading.set(false);
            this.googleActionSuccess.set('Liên kết tài khoản Google thành công!');
            setTimeout(() => this.googleActionSuccess.set(''), 4000);
          },
          (errMsg) => {
            this.googleLinkingLoading.set(false);
            this.googleActionError.set(errMsg);
            setTimeout(() => this.googleActionError.set(''), 5000);
          }
        );
      },
      (errorMsg) => {
        this.googleLinkingLoading.set(false);
        this.googleActionError.set(errorMsg);
        setTimeout(() => this.googleActionError.set(''), 5000);
      }
    );
  }

  openUnlinkGoogleModal(): void {
    this.unlinkPassword.set('');
    this.unlinkError.set('');
    this.showUnlinkModal.set(true);
  }

  closeUnlinkGoogleModal(): void {
    this.showUnlinkModal.set(false);
    this.unlinkPassword.set('');
    this.unlinkError.set('');
  }

  submitUnlinkGoogle(e: Event): void {
    e.preventDefault();
    this.unlinkError.set('');
    const pwd = this.unlinkPassword();
    if (!pwd) {
      this.unlinkError.set('Vui lòng nhập mật khẩu tài khoản để xác nhận.');
      return;
    }

    this.unlinkLoading.set(true);
    this.cart.unlinkGoogleAccount(
      pwd,
      () => {
        this.unlinkLoading.set(false);
        this.closeUnlinkGoogleModal();
        this.googleActionSuccess.set('Đã hủy liên kết Google thành công.');
        setTimeout(() => this.googleActionSuccess.set(''), 4000);
      },
      (errMsg) => {
        this.unlinkLoading.set(false);
        this.unlinkError.set(errMsg);
      }
    );
  }
}
