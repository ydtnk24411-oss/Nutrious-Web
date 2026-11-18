import { Component, OnInit, signal, inject, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  AuditLogApiService,
  AuditLogItem,
  AuditLogStats,
} from '../../shared/services/audit-log-api.service';

@Component({
  selector: 'app-admin-audit-log',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './audit-log.component.html',
  styleUrl: './audit-log.component.css',
})
export class AdminAuditLogComponent implements OnInit {
  protected readonly Math = Math;
  private auditApi = inject(AuditLogApiService);

  logs = signal<AuditLogItem[]>([]);
  stats = signal<AuditLogStats>({
    totalToday: 0,
    byCategory: [],
    byRole: [],
  });

  loading = signal(false);
  searchQuery = signal('');
  selectedCategory = signal<string>('all');
  selectedRole = signal<string>('all');

  // Pagination
  page = signal(1);
  pageSize = signal(15);
  total = signal(0);
  totalPages = signal(1);

  // Categories definition
  readonly categories = [
    { key: 'all', label: 'Tất cả danh mục' },
    { key: 'STAFF', label: 'Nhân sự & Phân quyền', badgeClass: 'badge-staff' },
    { key: 'ORDER', label: 'Đơn hàng & Giao vận', badgeClass: 'badge-order' },
    { key: 'INVENTORY', label: 'Kho bãi & Kiểm kê', badgeClass: 'badge-inventory' },
    { key: 'VOUCHER', label: 'Khuyến mãi & Voucher', badgeClass: 'badge-voucher' },
    { key: 'PRODUCT', label: 'Sản phẩm & Giá', badgeClass: 'badge-product' },
    { key: 'FINANCE', label: 'Tài chính & Hoàn tiền', badgeClass: 'badge-finance' },
    { key: 'SYSTEM', label: 'Hệ thống', badgeClass: 'badge-system' },
  ];

  // Roles definition
  readonly roles = [
    { key: 'all', label: 'Tất cả vai trò' },
    { key: 'manager', label: 'Quản lý (Manager)' },
    { key: 'admin', label: 'Quản trị viên (Admin)' },
    { key: 'sales', label: 'Kinh doanh & CSKH (Sales)' },
    { key: 'warehouse', label: 'Kho vận (Warehouse)' },
    { key: 'marketing', label: 'Marketing' },
  ];

  ngOnInit(): void {
    this.loadLogs();
    this.loadStats();
  }

  loadStats(): void {
    this.auditApi.getStats().subscribe({
      next: (res) => {
        if (res.success) {
          this.stats.set(res.data);
        }
      },
    });
  }

  loadLogs(): void {
    this.loading.set(true);
    const params: Record<string, string | number> = {
      page: this.page(),
      limit: this.pageSize(),
    };

    if (this.selectedCategory() !== 'all') {
      params['category'] = this.selectedCategory();
    }
    if (this.selectedRole() !== 'all') {
      params['role'] = this.selectedRole();
    }
    if (this.searchQuery().trim()) {
      params['search'] = this.searchQuery().trim();
    }

    this.auditApi.getAll(params).subscribe({
      next: (res) => {
        if (res.success) {
          this.logs.set(res.data);
          this.total.set(res.total);
          this.totalPages.set(res.totalPages);
        }
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  onSearch(): void {
    this.page.set(1);
    this.loadLogs();
  }

  onFilterChange(): void {
    this.page.set(1);
    this.loadLogs();
  }

  goToPage(p: number): void {
    if (p >= 1 && p <= this.totalPages() && p !== this.page()) {
      this.page.set(p);
      this.loadLogs();
    }
  }

  getRoleBadge(role: string): { label: string; class: string } {
    const r = (role || '').toLowerCase();
    switch (r) {
      case 'manager':
        return { label: 'Manager', class: 'role-manager' };
      case 'admin':
        return { label: 'Admin', class: 'role-admin' };
      case 'sales':
        return { label: 'Sales', class: 'role-sales' };
      case 'warehouse':
        return { label: 'Warehouse', class: 'role-warehouse' };
      case 'marketing':
        return { label: 'Marketing', class: 'role-marketing' };
      default:
        return { label: role || 'Staff', class: 'role-default' };
    }
  }

  getCategoryBadge(cat: string): { label: string; badgeClass: string } {
    const found = this.categories.find((c) => c.key === cat);
    return {
      label: found ? found.label : cat,
      badgeClass: found?.badgeClass || 'badge-system',
    };
  }
}
