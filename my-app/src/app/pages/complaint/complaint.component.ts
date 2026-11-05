import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { ShellComponent } from '../../components/shell/shell.component';
import { CartService } from '../../shared/services/cart.service';
import {
  ComplaintApiService,
  ComplaintItem,
  ComplaintType,
  ComplaintStatus,
} from '../../shared/services/complaint-api.service';

@Component({
  selector: 'app-complaint',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterLink, ShellComponent],
  templateUrl: './complaint.component.html',
  styleUrl: './complaint.component.css',
})
export class ComplaintComponent implements OnInit {
  protected cart = inject(CartService);
  private complaintApi = inject(ComplaintApiService);
  private route = inject(ActivatedRoute);

  // Active view: 'form' | 'track' | 'history'
  activeTab = signal<'form' | 'track' | 'history'>('form');

  // Form fields
  customerName = signal('');
  customerPhone = signal('');
  customerEmail = signal('');
  orderCode = signal('');
  type = signal<ComplaintType>('product');
  title = signal('');
  description = signal('');
  images = signal<string[]>([]);

  // State
  submitting = signal(false);
  errorMessage = signal('');
  submittedComplaint = signal<ComplaintItem | null>(null);

  // Track tab
  trackCode = signal('');
  tracking = signal(false);
  trackError = signal('');
  trackedComplaint = signal<ComplaintItem | null>(null);

  // My complaints tab
  myComplaints = signal<ComplaintItem[]>([]);
  loadingMyComplaints = signal(false);

  readonly typeOptions: { value: ComplaintType; label: string; iconKey: string; desc: string }[] = [
    {
      value: 'product',
      label: 'Chất lượng sản phẩm',
      iconKey: 'product',
      desc: 'Hàng dập nát, hư hỏng, không tươi ngon hoặc sai quy cách',
    },
    {
      value: 'delivery',
      label: 'Vận chuyển & Giao hàng',
      iconKey: 'delivery',
      desc: 'Giao trễ, thái độ shipper, đóng gói bảo quản không đảm bảo',
    },
    {
      value: 'order',
      label: 'Đơn hàng & Hàng hóa',
      iconKey: 'order',
      desc: 'Giao thiếu hàng, giao nhầm món, không đúng hóa đơn',
    },
    {
      value: 'payment',
      label: 'Thanh toán & Hoàn tiền',
      iconKey: 'payment',
      desc: 'Trừ tiền trùng lặp, cần hoàn tiền hoặc voucher bồi thường',
    },
    {
      value: 'other',
      label: 'Vấn đề & Đóng góp khác',
      iconKey: 'other',
      desc: 'Góp ý dịch vụ hoặc phản ánh các vấn đề khác',
    },
  ];

  readonly statusMap: Record<ComplaintStatus, { label: string; bg: string; color: string; border: string }> = {
    pending: {
      label: 'Đang chờ tiếp nhận',
      bg: '#fefce8',
      color: '#854d0e',
      border: '#fef08a',
    },
    processing: {
      label: 'Đang xử lý & kiểm tra',
      bg: '#f0fdf4',
      color: '#166534',
      border: '#bbf7d0',
    },
    resolved: {
      label: 'Đã giải quyết xong',
      bg: '#ecfccb',
      color: '#365314',
      border: '#bef264',
    },
    rejected: {
      label: 'Từ chối giải quyết',
      bg: '#fef2f2',
      color: '#991b1b',
      border: '#fecaca',
    },
  };

  ngOnInit(): void {
    // Auto-fill user information if logged in
    const user = this.cart.currentUser();
    if (user) {
      if (user.name) this.customerName.set(user.name);
      if (user.phone) this.customerPhone.set(user.phone);
      if (user.email) this.customerEmail.set(user.email);
    }

    // Check query params (e.g. ?orderCode=XL-12345 or ?code=KN-12345 or ?tab=track)
    this.route.queryParams.subscribe((params) => {
      if (params['orderCode']) {
        this.orderCode.set(params['orderCode']);
      }
      if (params['code']) {
        this.trackCode.set(params['code']);
        this.activeTab.set('track');
        this.onTrackSubmit();
      } else if (params['tab'] === 'track') {
        this.activeTab.set('track');
      } else if (params['tab'] === 'history' && user) {
        this.switchTab('history');
      }
    });
  }

  switchTab(tab: 'form' | 'track' | 'history'): void {
    this.activeTab.set(tab);
    if (tab === 'history') {
      this.loadMyComplaints();
    }
  }

  onImageSelect(e: Event): void {
    const input = e.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const files = Array.from(input.files);
    if (this.images().length + files.length > 4) {
      alert('Bạn chỉ có thể đính kèm tối đa 4 hình ảnh.');
      return;
    }

    for (const file of files) {
      if (file.size > 3 * 1024 * 1024) {
        alert(`Ảnh "${file.name}" vượt quá kích thước cho phép (tối đa 3MB).`);
        continue;
      }
      if (!file.type.startsWith('image/')) {
        alert(`File "${file.name}" không phải định dạng ảnh hợp lệ.`);
        continue;
      }

      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        this.images.update((prev) => [...prev, base64]);
      };
      reader.readAsDataURL(file);
    }
    input.value = '';
  }

  removeImage(index: number): void {
    this.images.update((prev) => prev.filter((_, i) => i !== index));
  }

  onSubmit(): void {
    this.errorMessage.set('');

    const name = this.customerName().trim();
    const phone = this.customerPhone().trim();
    const title = this.title().trim();
    const desc = this.description().trim();

    if (!name) {
      this.errorMessage.set('Vui lòng nhập họ và tên của bạn.');
      return;
    }
    if (!phone) {
      this.errorMessage.set('Vui lòng nhập số điện thoại để nhân viên liên hệ xử lý.');
      return;
    }
    if (!title) {
      this.errorMessage.set('Vui lòng nhập tiêu đề khiếu nại.');
      return;
    }
    if (!desc) {
      this.errorMessage.set('Vui lòng mô tả chi tiết vấn đề bạn gặp phải.');
      return;
    }

    this.submitting.set(true);

    const payload = {
      customerName: name,
      customerPhone: phone,
      customerEmail: this.customerEmail().trim(),
      orderCode: this.orderCode().trim() || undefined,
      type: this.type(),
      title,
      description: desc,
      images: this.images(),
    };

    this.complaintApi.create(payload).subscribe({
      next: (res) => {
        this.submitting.set(false);
        if (res.success && res.data) {
          this.submittedComplaint.set(res.data);
        } else {
          this.errorMessage.set('Không thể gửi khiếu nại. Vui lòng thử lại.');
        }
      },
      error: (err) => {
        this.submitting.set(false);
        this.errorMessage.set(
          err.error?.message || 'Có lỗi xảy ra trong quá trình gửi khiếu nại. Vui lòng thử lại sau.'
        );
      },
    });
  }

  resetForm(): void {
    this.submittedComplaint.set(null);
    this.title.set('');
    this.description.set('');
    this.images.set([]);
    this.errorMessage.set('');
  }

  onTrackSubmit(e?: Event): void {
    if (e) e.preventDefault();
    const code = this.trackCode().trim().toUpperCase();
    if (!code) {
      this.trackError.set('Vui lòng nhập mã khiếu nại cần tra cứu.');
      return;
    }

    this.tracking.set(true);
    this.trackError.set('');
    this.trackedComplaint.set(null);

    this.complaintApi.track(code).subscribe({
      next: (res) => {
        this.tracking.set(false);
        if (res.success && res.data) {
          this.trackedComplaint.set(res.data);
        } else {
          this.trackError.set('Không tìm thấy khiếu nại với mã này.');
        }
      },
      error: (err) => {
        this.tracking.set(false);
        this.trackError.set(err.error?.message || 'Không tìm thấy khiếu nại với mã đã nhập.');
      },
    });
  }

  viewTrackDetail(code: string): void {
    this.trackCode.set(code);
    this.activeTab.set('track');
    this.onTrackSubmit();
  }

  loadMyComplaints(): void {
    if (!this.cart.currentUser()) return;
    this.loadingMyComplaints.set(true);
    this.complaintApi.getMyComplaints().subscribe({
      next: (res) => {
        this.loadingMyComplaints.set(false);
        if (res.success) {
          this.myComplaints.set(res.data || []);
        }
      },
      error: () => {
        this.loadingMyComplaints.set(false);
      },
    });
  }

  copyCode(code: string): void {
    navigator.clipboard?.writeText(code);
    alert(`Đã sao chép mã khiếu nại: ${code}`);
  }

  getTypeLabel(t: ComplaintType): string {
    const found = this.typeOptions.find((o) => o.value === t);
    return found ? found.label : t;
  }
}

