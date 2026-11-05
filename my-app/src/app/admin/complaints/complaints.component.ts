import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ComplaintApiService,
  ComplaintItem,
  ComplaintStats,
  ComplaintStatus,
} from '../../shared/services/complaint-api.service';

@Component({
  selector: 'app-admin-complaints',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './complaints.component.html',
  styleUrl: './complaints.component.css',
})
export class AdminComplaintsComponent implements OnInit {
  private complaintApi = inject(ComplaintApiService);

  complaints = signal<ComplaintItem[]>([]);
  stats = signal<ComplaintStats>({
    total: 0,
    pending: 0,
    processing: 0,
    resolved: 0,
    rejected: 0,
  });

  loading = signal(false);
  searchQuery = signal('');
  selectedStatus = signal<string>('all');
  selectedType = signal<string>('all');

  // Modal
  detailModalOpen = signal(false);
  activeComplaint = signal<ComplaintItem | null>(null);
  updateStatus = signal<ComplaintStatus>('processing');
  resolutionNote = signal<string>('');
  submitting = signal(false);

  ngOnInit(): void {
    this.loadComplaints();
  }

  loadComplaints(): void {
    this.loading.set(true);
    const params: Record<string, string | number> = { limit: 50 };
    if (this.searchQuery()) params['search'] = this.searchQuery();
    if (this.selectedStatus() !== 'all') params['status'] = this.selectedStatus();
    if (this.selectedType() !== 'all') params['type'] = this.selectedType();

    this.complaintApi.getAll(params).subscribe({
      next: (res) => {
        if (res.success) {
          this.complaints.set(res.data);
          if (res.stats) this.stats.set(res.stats);
        }
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  openDetailModal(item: ComplaintItem): void {
    this.activeComplaint.set(item);
    this.updateStatus.set(item.status);
    this.resolutionNote.set(item.resolutionNote || '');
    this.detailModalOpen.set(true);
  }

  closeDetailModal(): void {
    this.detailModalOpen.set(false);
    this.activeComplaint.set(null);
  }

  submitResolution(): void {
    const item = this.activeComplaint();
    if (!item) return;

    this.submitting.set(true);
    this.complaintApi
      .update(item._id, {
        status: this.updateStatus(),
        resolutionNote: this.resolutionNote(),
      })
      .subscribe({
        next: (res) => {
          this.submitting.set(false);
          if (res.success) {
            this.closeDetailModal();
            this.loadComplaints();
          }
        },
        error: () => {
          this.submitting.set(false);
          alert('Không thể lưu cập nhật khiếu nại.');
        },
      });
  }

  getTypeLabel(type: string): string {
    switch (type) {
      case 'product':
        return 'Chất lượng sản phẩm';
      case 'delivery':
        return 'Giao hàng trễ / hỏng';
      case 'order':
        return 'Sai sót đơn hàng';
      case 'payment':
        return 'Thanh toán & Tiền';
      default:
        return 'Vấn đề khác';
    }
  }

  getStatusBadge(status: ComplaintStatus): { text: string; cssClass: string } {
    switch (status) {
      case 'pending':
        return { text: 'Chờ xử lý', cssClass: 'badge-danger' };
      case 'processing':
        return { text: 'Đang xử lý', cssClass: 'badge-warning' };
      case 'resolved':
        return { text: 'Đã giải quyết', cssClass: 'badge-success' };
      case 'rejected':
        return { text: 'Từ chối', cssClass: 'badge-secondary' };
      default:
        return { text: status, cssClass: '' };
    }
  }
}

