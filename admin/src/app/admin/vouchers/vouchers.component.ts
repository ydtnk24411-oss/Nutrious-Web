import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  VoucherAdminApiService,
  AdminVoucher,
  VoucherStats,
} from '../../shared/services/voucher-admin-api.service';

@Component({
  selector: 'app-admin-vouchers',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './vouchers.component.html',
  styleUrl: './vouchers.component.css',
})
export class AdminVouchersComponent implements OnInit {
  private voucherApi = inject(VoucherAdminApiService);

  vouchers = signal<AdminVoucher[]>([]);
  stats = signal<VoucherStats>({
    total: 0,
    active: 0,
    expired: 0,
    totalUsed: 0,
  });

  loading = signal(false);
  searchQuery = signal('');
  selectedStatus = signal<string>('all');
  successMsg = signal('');

  // Modal
  modalOpen = signal(false);
  editingVoucher = signal<AdminVoucher | null>(null);
  formCode = signal('');
  formName = signal('');
  formDescription = signal('');
  formType = signal<'percentage' | 'fixed'>('fixed');
  formValue = signal<number>(20000);
  formMinOrder = signal<number>(100000);
  formMaxDiscount = signal<number | null>(null);
  formStartDate = signal('');
  formEndDate = signal('');
  formUsageLimit = signal<number>(100);
  formIsActive = signal<boolean>(true);
  submitting = signal(false);

  ngOnInit(): void {
    this.loadVouchers();
  }

  loadVouchers(): void {
    this.loading.set(true);
    const params: Record<string, string | number> = {};
    if (this.searchQuery()) params['search'] = this.searchQuery();
    if (this.selectedStatus() !== 'all') params['status'] = this.selectedStatus();

    this.voucherApi.getAll(params).subscribe({
      next: (res) => {
        if (res.success) {
          this.vouchers.set(res.data);
          if (res.stats) this.stats.set(res.stats);
        }
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  openCreateModal(): void {
    this.editingVoucher.set(null);
    this.formCode.set('');
    this.formName.set('');
    this.formDescription.set('');
    this.formType.set('fixed');
    this.formValue.set(20000);
    this.formMinOrder.set(100000);
    this.formMaxDiscount.set(null);

    const today = new Date();
    const nextMonth = new Date(Date.now() + 30 * 86400000);
    this.formStartDate.set(today.toISOString().split('T')[0]);
    this.formEndDate.set(nextMonth.toISOString().split('T')[0]);
    this.formUsageLimit.set(100);
    this.formIsActive.set(true);

    this.modalOpen.set(true);
  }

  openEditModal(item: AdminVoucher): void {
    this.editingVoucher.set(item);
    this.formCode.set(item.code);
    this.formName.set(item.name);
    this.formDescription.set(item.description || '');
    this.formType.set(item.discountType);
    this.formValue.set(item.discountValue);
    this.formMinOrder.set(item.minOrderValue || 0);
    this.formMaxDiscount.set(item.maxDiscountValue || null);
    this.formStartDate.set(new Date(item.startDate).toISOString().split('T')[0]);
    this.formEndDate.set(new Date(item.endDate).toISOString().split('T')[0]);
    this.formUsageLimit.set(item.usageLimit || 0);
    this.formIsActive.set(item.isActive);

    this.modalOpen.set(true);
  }

  closeModal(): void {
    this.modalOpen.set(false);
    this.editingVoucher.set(null);
  }

  saveVoucher(): void {
    const code = this.formCode().trim().toUpperCase();
    const name = this.formName().trim();

    if (!code || !name) {
      alert('Vui lòng nhập mã voucher và tên chương trình');
      return;
    }
    if (this.formValue() <= 0) {
      alert('Giá trị giảm phải lớn hơn 0');
      return;
    }

    this.submitting.set(true);
    const payload: Partial<AdminVoucher> = {
      code,
      name,
      description: this.formDescription(),
      discountType: this.formType(),
      discountValue: this.formValue(),
      minOrderValue: this.formMinOrder(),
      maxDiscountValue: this.formMaxDiscount(),
      startDate: new Date(this.formStartDate()).toISOString(),
      endDate: new Date(this.formEndDate()).toISOString(),
      usageLimit: this.formUsageLimit(),
      isActive: this.formIsActive(),
    };

    const editItem = this.editingVoucher();
    const req$ = editItem
      ? this.voucherApi.update(editItem._id, payload)
      : this.voucherApi.create(payload);

    req$.subscribe({
      next: (res) => {
        this.submitting.set(false);
        if (res.success) {
          this.closeModal();
          this.successMsg.set(`Đã lưu voucher "${code}" thành công`);
          setTimeout(() => this.successMsg.set(''), 4000);
          this.loadVouchers();
        }
      },
      error: (err) => {
        this.submitting.set(false);
        alert(err.error?.message || 'Lỗi khi lưu voucher');
      },
    });
  }

  toggleActive(item: AdminVoucher): void {
    this.voucherApi.toggleActive(item._id, !item.isActive).subscribe({
      next: (res) => {
        if (res.success) this.loadVouchers();
      },
    });
  }

  deleteVoucher(item: AdminVoucher): void {
    if (!confirm(`Bạn có chắc chắn muốn xóa voucher "${item.code}"?`)) return;

    this.voucherApi.remove(item._id).subscribe({
      next: (res) => {
        if (res.success) this.loadVouchers();
      },
      error: () => alert('Không thể xóa voucher.'),
    });
  }

  isExpired(endDate: string): boolean {
    return new Date(endDate).getTime() < Date.now();
  }
}

