import { Component, signal, inject, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserApiService, ApiUser, ApiUserWithStats, UserRole } from '../../shared/services/user-api.service';
import { OrderApiService, ApiOrder } from '../../shared/services/order-api.service';

@Component({
  selector: 'app-admin-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './users.component.html',
  styleUrl: './users.component.css',
})
export class AdminUsersComponent implements OnInit {
  private userApi = inject(UserApiService);
  private orderApi = inject(OrderApiService);

  users    = signal<ApiUserWithStats[]>([]);
  total    = signal(0);
  loading  = signal(true);
  saving   = signal(false);
  error    = signal('');
  success  = signal('');

  search = signal('');
  role   = signal('');
  page   = signal(1);
  readonly limit = 15;

  selected   = signal<ApiUserWithStats | null>(null);
  modalOpen  = signal(false);
  editRole   = signal<UserRole>('customer');
  editActive = signal(true);

  // Detail Drawer / Modal
  detailUser = signal<ApiUserWithStats | null>(null);
  detailModalOpen = signal(false);
  userOrders = signal<ApiOrder[]>([]);
  loadingOrders = signal(false);

  totalPages = computed(() => Math.ceil(this.total() / this.limit));

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    const p: Record<string, string | number> = { page: this.page(), limit: this.limit };
    if (this.search()) p['search'] = this.search();
    if (this.role())   p['role']   = this.role();
    this.userApi.getWithStats(p).subscribe({
      next:  (r) => { this.users.set(r.data); this.total.set(r.total); this.loading.set(false); },
      error: ()  => { this.error.set('Không thể tải người dùng.'); this.loading.set(false); },
    });
  }

  onSearch(v: string): void { this.search.set(v); this.page.set(1); this.load(); }
  onRole(v: string): void   { this.role.set(v);   this.page.set(1); this.load(); }
  prevPage(): void { if (this.page() > 1)              { this.page.update(p => p - 1); this.load(); } }
  nextPage(): void { if (this.page() < this.totalPages()){ this.page.update(p => p + 1); this.load(); } }

  openEdit(u: ApiUserWithStats): void {
    this.selected.set(u);
    this.editRole.set(u.role);
    this.editActive.set(u.isActive);
    this.error.set('');
    this.modalOpen.set(true);
  }
  closeModal(): void { this.modalOpen.set(false); }

  openDetail(u: ApiUserWithStats): void {
    this.detailUser.set(u);
    this.detailModalOpen.set(true);
    this.loadingOrders.set(true);
    this.userOrders.set([]);
    this.orderApi.getAll({ user: u._id, limit: 10 }).subscribe({
      next: (res) => {
        this.userOrders.set(res.data || []);
        this.loadingOrders.set(false);
      },
      error: () => {
        this.loadingOrders.set(false);
      }
    });
  }
  closeDetailModal(): void {
    this.detailModalOpen.set(false);
    this.detailUser.set(null);
  }

  toggleActive(u: ApiUserWithStats): void {
    const action = u.isActive ? 'Khóa' : 'Kích hoạt lại';
    if (!confirm(`Bạn có chắc muốn ${action} tài khoản "${u.name}"?`)) return;
    this.userApi.toggleActive(u._id, !u.isActive).subscribe({
      next: () => {
        this.success.set(`Đã ${action.toLowerCase()} tài khoản thành công!`);
        setTimeout(() => this.success.set(''), 3000);
        this.load();
        if (this.detailUser()?._id === u._id) {
          this.detailUser.update(prev => prev ? { ...prev, isActive: !prev.isActive } : null);
        }
      },
      error: () => this.error.set('Thao tác thất bại.')
    });
  }

  save(): void {
    const u = this.selected();
    if (!u) return;
    this.saving.set(true);
    this.userApi.update(u._id, { role: this.editRole(), isActive: this.editActive() }).subscribe({
      next: () => {
        this.saving.set(false);
        this.closeModal();
        this.success.set('Đã cập nhật người dùng!');
        setTimeout(() => this.success.set(''), 3000);
        this.load();
      },
      error: (err) => { this.saving.set(false); this.error.set(err.error?.message || 'Lưu thất bại.'); },
    });
  }

  remove(u: ApiUserWithStats): void {
    if (!confirm(`Vô hiệu hoá tài khoản "${u.name}"?`)) return;
    this.userApi.remove(u._id).subscribe({
      next: () => { this.success.set('Đã vô hiệu hoá tài khoản.'); setTimeout(() => this.success.set(''), 3000); this.load(); },
      error: () => this.error.set('Thao tác thất bại.'),
    });
  }

  // Behavioral segmentation
  getCustomerSegment(user: ApiUserWithStats): string {
    if (user.orderCount === 0) return 'Mới';
    if (user.totalSpent >= 1000000) return 'VIP';
    if (user.orderCount >= 5) return 'Thân thiết';
    return 'Trung bình';
  }

  getSegmentColor(segment: string): string {
    const colors: Record<string, string> = {
      'Mới': '#9ca3af',
      'Trung bình': '#3b82f6',
      'Thân thiết': '#f59e0b',
      'VIP': '#ef4444',
    };
    return colors[segment] || '#6b7280';
  }

  formatPrice(val: number): string {
    return (val || 0).toLocaleString('vi-VN') + ' ₫';
  }

  formatDate(dateStr: string | null): string {
    if (!dateStr) return '—';
    const date = new Date(dateStr);
    return date.toLocaleDateString('vi-VN');
  }

  getOrderStatusLabel(status: string): string {
    const map: Record<string, string> = {
      pending: 'Chờ xác nhận',
      confirmed: 'Đã xác nhận',
      preparing: 'Đang chuẩn bị',
      shipping: 'Đang giao',
      delivered: 'Đã giao',
      cancelled: 'Đã hủy',
    };
    return map[status] || status;
  }
}
