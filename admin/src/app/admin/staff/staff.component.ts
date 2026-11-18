import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserApiService, ApiUser, UserRole } from '../../shared/services/user-api.service';

interface RoleDefinition {
  key: UserRole;
  label: string;
  desc: string;
  color: string;
  bg: string;
}

@Component({
  selector: 'app-admin-staff',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './staff.component.html',
  styleUrl: './staff.component.css',
})
export class AdminStaffComponent implements OnInit {
  private userApi = inject(UserApiService);

  staffList = signal<ApiUser[]>([]);
  loading = signal(false);
  searchQuery = signal('');
  selectedRole = signal<string>('all');
  successMsg = signal('');

  // Role metadata
  readonly roleDefs: RoleDefinition[] = [
    {
      key: 'admin',
      label: 'Quản trị viên (Admin)',
      desc: '',
      color: '#b91c1c',
      bg: '#fee2e2',
    },
    {
      key: 'manager',
      label: 'Cửa hàng trưởng (Store Manager)',
      desc: '',
      color: '#047857',
      bg: '#d1fae5',
    },
    {
      key: 'warehouse',
      label: 'Nhân viên kho (Warehouse)',
      desc: '',
      color: '#d97706',
      bg: '#fef3c7',
    },
    {
      key: 'sales',
      label: 'Nhân viên bán hàng (Sales)',
      desc: '',
      color: '#1d4ed8',
      bg: '#dbeafe',
    },
    {
      key: 'marketing',
      label: 'Nhân viên Marketing',
      desc: '',
      color: '#7e22ce',
      bg: '#f3e8ff',
    },
  ];

  // Modal
  modalOpen = signal(false);
  editingStaff = signal<ApiUser | null>(null);
  formName = signal('');
  formEmail = signal('');
  formPhone = signal('');
  formPassword = signal('');
  formRole = signal<UserRole>('manager');
  formIsActive = signal(true);
  submitting = signal(false);

  ngOnInit(): void {
    this.loadStaff();
  }

  loadStaff(): void {
    this.loading.set(true);
    // Fetch all users with roles other than 'customer' (or all users and filter)
    this.userApi.getAll({ limit: 100 }).subscribe({
      next: (res) => {
        if (res.success) {
          // Filter for staff/admin roles
          const staff = res.data.filter((u) => u.role !== 'customer');
          this.staffList.set(staff);
        }
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  filteredStaff(): ApiUser[] {
    const q = this.searchQuery().toLowerCase().trim();
    return this.staffList().filter((u) => {
      const matchSearch =
        !q ||
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.employeeCode && u.employeeCode.toLowerCase().includes(q)) ||
        (u.phone && u.phone.includes(q)) ||
        (u.storeName && u.storeName.toLowerCase().includes(q));

      const matchRole =
        this.selectedRole() === 'all' || u.role === this.selectedRole();

      return matchSearch && matchRole;
    });
  }

  openCreateModal(): void {
    this.editingStaff.set(null);
    this.formName.set('');
    this.formEmail.set('');
    this.formPhone.set('');
    this.formPassword.set('');
    this.formRole.set('manager');
    this.formIsActive.set(true);
    this.modalOpen.set(true);
  }

  openEditModal(user: ApiUser): void {
    this.editingStaff.set(user);
    this.formName.set(user.name);
    this.formEmail.set(user.email);
    this.formPhone.set(user.phone || '');
    this.formPassword.set('');
    let r: UserRole = user.role;
    if ((r as string) === 'support') r = 'sales';
    if ((r as string) === 'content') r = 'marketing';
    if (!['admin', 'manager', 'warehouse', 'sales', 'marketing'].includes(r)) r = 'manager';
    this.formRole.set(r);
    this.formIsActive.set(user.isActive);
    this.modalOpen.set(true);
  }

  closeModal(): void {
    this.modalOpen.set(false);
    this.editingStaff.set(null);
  }

  saveStaff(): void {
    const name = this.formName().trim();
    const email = this.formEmail().trim();

    if (!name || !email) {
      alert('Vui lòng nhập họ tên và email nhân viên');
      return;
    }

    this.submitting.set(true);
    const editItem = this.editingStaff();

    if (editItem) {
      const payload: Partial<ApiUser> & { password?: string } = {
        name,
        email,
        phone: this.formPhone(),
        role: this.formRole(),
        isActive: this.formIsActive(),
      };
      if (this.formPassword().trim()) {
        payload.password = this.formPassword().trim();
      }

      this.userApi.update(editItem._id, payload).subscribe({
        next: (res) => {
          this.submitting.set(false);
          if (res.success) {
            this.closeModal();
            this.successMsg.set(`Đã cập nhật tài khoản "${name}"`);
            setTimeout(() => this.successMsg.set(''), 4000);
            this.loadStaff();
          }
        },
        error: (err) => {
          this.submitting.set(false);
          alert(err.error?.message || 'Lỗi khi cập nhật tài khoản.');
        },
      });
    } else {
      if (!this.formPassword().trim() || this.formPassword().trim().length < 6) {
        alert('Mật khẩu khởi tạo phải từ 6 ký tự trở lên');
        this.submitting.set(false);
        return;
      }

      this.userApi
        .createStaff({
          name,
          email,
          phone: this.formPhone(),
          password: this.formPassword().trim(),
          role: this.formRole(),
        })
        .subscribe({
          next: (res) => {
            this.submitting.set(false);
            if (res.success) {
              this.closeModal();
              this.successMsg.set(`Đã tạo tài khoản nhân viên "${name}"`);
              setTimeout(() => this.successMsg.set(''), 4000);
              this.loadStaff();
            }
          },
          error: (err) => {
            this.submitting.set(false);
            alert(err.error?.message || 'Lỗi khi tạo tài khoản.');
          },
        });
    }
  }

  toggleActive(user: ApiUser): void {
    this.userApi.toggleActive(user._id, !user.isActive).subscribe({
      next: (res) => {
        if (res.success) this.loadStaff();
      },
    });
  }

  getRoleDef(role: UserRole): RoleDefinition {
    return (
      this.roleDefs.find((r) => r.key === role) || {
        key: role,
        label: role,
        desc: '',
        color: '#475569',
        bg: '#f1f5f9',
      }
    );
  }
}

