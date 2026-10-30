import { Component, signal, inject, OnInit, computed, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { ShellComponent } from '../../components/shell/shell.component';
import { CartService } from '../../shared/services/cart.service';
import { LoyaltyService } from '../../shared/services/loyalty.service';
import { VoucherService } from '../../shared/services/voucher.service';
import { XanhLaAddress } from '../../shared/models/xanh-la.models';

type Tab = 'overview' | 'orders' | 'addresses' | 'settings';

@Component({
  selector: 'app-account',
  standalone: true,
  imports: [CommonModule, ShellComponent, RouterLink],
  templateUrl: './account.component.html',
  styleUrl: './account.component.css',
})
export class AccountComponent implements OnInit {
  protected cart   = inject(CartService);
  protected router = inject(Router);
  private loyalty   = inject(LoyaltyService);
  private voucher   = inject(VoucherService);

  // ── Tab ──────────────────────────────────────
  activeTab = signal<Tab>('overview');

  // ── My Account form ──────────────────────────
  displayName = signal('');
  firstName   = signal('');
  lastName    = signal('');
  phone       = signal('');
  title       = signal('');
  avatar      = signal('');
  saved       = signal(false);
  saving      = signal(false);
  uploadingAvatar = signal(false);
  avatarMenuOpen = signal(false);

  // ── My Addresses ─────────────────────────────
  showAddressForm = signal(false);
  addrLabel    = signal('Nhà riêng');
  addrFullName = signal('');
  addrPhone    = signal('');
  addrAddress  = signal('');
  addrCity     = signal('');
  addrDefault  = signal(false);

  // ── Order History (mock data) ───────────────
  orders = signal([
    {
      id: '1',
      orderCode: 'XL-470634',
      date: '2025-10-10',
      total: 16000,
      status: 'delivered',
      items: [{ name: 'Rau Muống Tươi', quantity: 2, price: 8000 }],
    },
    {
      id: '2',
      orderCode: 'XL-470635',
      date: '2025-10-08',
      total: 32000,
      status: 'shipping',
      items: [{ name: 'Cà Rốt Baby Đà Lạt', quantity: 1, price: 32000 }],
    },
  ]);

  orderStatusFilter = signal<'all' | 'pending' | 'processing' | 'delivering' | 'completed' | 'cancelled'>('all');
  orderSearchQuery = signal('');

  filteredOrders = computed(() => {
    const statusFilter = this.orderStatusFilter();
    const searchQuery = this.orderSearchQuery().toLowerCase();

    return this.orders().filter(order => {
      const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
      const matchesSearch = searchQuery === '' || order.orderCode.toLowerCase().includes(searchQuery);
      return matchesStatus && matchesSearch;
    });
  });

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

  readonly availableRewards = computed(() => {
    return this.loyalty.getAvailableRewards();
  });

  ngOnInit(): void {
    const u = this.cart.currentUser();
    if (!u) { this.router.navigate(['/']); return; }
    this.displayName.set(u.name ?? '');
    this.firstName.set(u.firstName ?? '');
    this.lastName.set(u.lastName ?? '');
    this.phone.set(u.phone ?? '');
    this.title.set(u.title ?? '');
    this.avatar.set(u.avatar ?? '');
    console.log('Account component loaded, avatar:', u.avatar ? 'Has avatar' : 'No avatar');
    // Pre-fill address form name
    this.addrFullName.set(u.name ?? '');
    this.addrPhone.set(u.phone ?? '');
  }

  // ── Save account info ────────────────────────
  saveAccount(e: Event): void {
    e.preventDefault();
    this.saving.set(true);
    // Build full display name từ firstName + lastName nếu có
    const fullName = [this.firstName(), this.lastName()].filter(Boolean).join(' ') || this.displayName();
    const updateData = {
      name:      fullName,
      firstName: this.firstName(),
      lastName:  this.lastName(),
      phone:     this.phone(),
      title:     this.title(),
      avatar:    this.avatar(),
    };
    console.log('Saving account with data:', updateData);
    this.cart.updateUser(updateData);
    setTimeout(() => {
      this.saving.set(false);
      this.saved.set(true);
      setTimeout(() => this.saved.set(false), 3000);
    }, 400);
  }

  // ── Upload Avatar ────────────────────────────
  onAvatarUpload(event: Event): void {
    console.log('onAvatarUpload triggered');
    const input = event.target as HTMLInputElement;
    console.log('Input element:', input);
    console.log('Input files:', input.files);
    console.log('Input files length:', input.files?.length);

    const file = input.files?.[0];
    if (!file) {
      console.log('No file selected');
      return;
    }

    console.log('Avatar upload started:', file.name, file.size, file.type);

    // Validate file size (max 2MB)
    if (file.size > 2 * 1024 * 1024) {
      alert('Kích thước ảnh không được vượt quá 2MB');
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Vui lòng chọn file ảnh');
      return;
    }

    this.uploadingAvatar.set(true);

    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      console.log('Avatar converted to base64, length:', base64.length);
      this.avatar.set(base64);
      this.uploadingAvatar.set(false);

      // Auto-save avatar to backend
      console.log('Saving avatar to backend...');
      this.cart.updateUser({ avatar: base64 });
    };
    reader.onerror = () => {
      console.error('FileReader error');
      alert('Không thể đọc file ảnh');
      this.uploadingAvatar.set(false);
    };
    reader.readAsDataURL(file);
  }

  triggerAvatarInput(inputId: string): void {
    console.log('triggerAvatarInput called with ID:', inputId);
    const input = document.getElementById(inputId) as HTMLInputElement;
    console.log('Input element found:', !!input);
    if (input) {
      console.log('Clicking input...');
      input.click();
    } else {
      console.error('Input element not found');
    }
  }

  removeAvatar(): void {
    if (confirm('Bạn có chắc muốn xóa ảnh đại diện?')) {
      this.avatar.set('');
      this.avatarMenuOpen.set(false);

      // Auto-save empty avatar to backend
      this.cart.updateUser({ avatar: '' });
    }
  }

  toggleAvatarMenu(): void {
    console.log('toggleAvatarMenu called, current state:', this.avatarMenuOpen());
    this.avatarMenuOpen.update(v => !v);
    console.log('toggleAvatarMenu new state:', this.avatarMenuOpen());
  }

  closeAvatarMenu(): void {
    console.log('closeAvatarMenu called');
    this.avatarMenuOpen.set(false);
  }

  cancelAccount(): void {
    const u = this.cart.currentUser();
    if (!u) return;
    this.displayName.set(u.name ?? '');
    this.firstName.set(u.firstName ?? '');
    this.lastName.set(u.lastName ?? '');
    this.phone.set(u.phone ?? '');
    this.title.set(u.title ?? '');
  }

  // ── Addresses ────────────────────────────────
  addAddress(e: Event): void {
    e.preventDefault();
    if (!this.addrFullName() || !this.addrAddress()) return;
    const addr: XanhLaAddress = {
      id:        Date.now().toString(),
      label:     this.addrLabel(),
      fullName:  this.addrFullName(),
      phone:     this.addrPhone(),
      address:   this.addrAddress(),
      city:      this.addrCity(),
      isDefault: this.addrDefault(),
    };
    this.cart.addAddress(addr);
    this.resetAddressForm();
    this.showAddressForm.set(false);
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

  editAddress(id: string): void {
    const addr = this.cart.currentUser()?.addresses?.find(a => a.id === id);
    if (addr) {
      this.addrLabel.set(addr.label);
      this.addrFullName.set(addr.fullName);
      this.addrPhone.set(addr.phone);
      this.addrAddress.set(addr.address);
      this.addrCity.set(addr.city);
      this.addrDefault.set(addr.isDefault);
      this.showAddressForm.set(true);
    }
  }

  private resetAddressForm(): void {
    this.addrLabel.set('Nhà riêng');
    this.addrAddress.set('');
    this.addrCity.set('');
    this.addrDefault.set(false);
  }

  // ── Orders ─────────────────────────────────
  getOrderStatusText(status: string): string {
    const statusMap: Record<string, string> = {
      pending: 'Chờ xác nhận',
      confirmed: 'Đã xác nhận',
      processing: 'Đang xử lý',
      preparing: 'Đang chuẩn bị',
      shipping: 'Đang giao',
      delivering: 'Đang giao',
      delivered: 'Đã giao',
      completed: 'Đã giao',
      cancelled: 'Đã hủy',
      returned: 'Đã hoàn trả',
    };
    return statusMap[status] || status;
  }

  getOrderStatusClass(status: string): string {
    const classMap: Record<string, string> = {
      pending: 'status-pending',
      confirmed: 'status-confirmed',
      preparing: 'status-preparing',
      shipping: 'status-shipping',
      delivered: 'status-delivered',
      cancelled: 'status-cancelled',
      returned: 'status-returned',
    };
    return classMap[status] || '';
  }

  // ── Vouchers ────────────────────────────────
  collectVoucher(voucherId: string): void {
    if (this.voucher.collectVoucher(voucherId)) {
      alert('Đã thu thập voucher thành công!');
    }
  }

  // ── Points & Rewards ────────────────────────
  redeemReward(rewardId: string): void {
    const user = this.cart.currentUser();
    if (!user) return;

    const result = this.loyalty.redeemReward(user.email, rewardId);
    if (result.success) {
      alert('Đổi quà thành công!');
    } else {
      alert(result.message || 'Không thể đổi quà');
    }
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

  maskPassword(): string { return '•••••••'; }

  formatPrice(value: number): string {
    return value.toLocaleString('vi-VN') + 'đ';
  }

  @HostListener('document:click', ['$event'])
  onDocClick(e: Event): void {
    const t = e.target as HTMLElement;
    if (!t.closest('.acc-avatar-menu') && !t.closest('.acc-avatar-edit-btn')) {
      this.avatarMenuOpen.set(false);
    }
  }
}
