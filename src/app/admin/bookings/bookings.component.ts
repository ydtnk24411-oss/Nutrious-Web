import { Component, signal, inject, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BookingApiService, ApiBooking } from '../../shared/services/booking-api.service';

@Component({
  selector: 'app-admin-bookings',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './bookings.component.html',
  styleUrl: './bookings.component.css',
})
export class AdminBookingsComponent implements OnInit {
  private bookingApi = inject(BookingApiService);

  bookings = signal<ApiBooking[]>([]);
  total    = signal(0);
  loading  = signal(true);
  saving   = signal(false);
  error    = signal('');
  success  = signal('');

  search    = signal('');
  status    = signal('');
  page      = signal(1);
  readonly limit = 15;

  selected  = signal<ApiBooking | null>(null);
  modalOpen = signal(false);
  newStatus = signal('');

  totalPages = computed(() => Math.ceil(this.total() / this.limit));

  readonly statusOptions = [
    { value: 'pending',   label: 'Chờ xác nhận' },
    { value: 'confirmed', label: 'Đã xác nhận'  },
    { value: 'completed', label: 'Hoàn thành'   },
    { value: 'cancelled', label: 'Đã hủy'       },
  ];

  readonly statusLabel: Record<string, string> = {
    pending: 'Chờ xác nhận', confirmed: 'Đã xác nhận',
    completed: 'Hoàn thành',  cancelled: 'Đã hủy',
  };

  ngOnInit(): void { this.load(); }

  load(): void {
    this.loading.set(true);
    const p: Record<string, string | number> = { page: this.page(), limit: this.limit };
    if (this.search()) p['search'] = this.search();
    if (this.status()) p['status'] = this.status();
    this.bookingApi.getAll(p).subscribe({
      next:  (r) => { this.bookings.set(r.data); this.total.set(r.total); this.loading.set(false); },
      error: ()  => { this.error.set('Không thể tải đặt lịch.'); this.loading.set(false); },
    });
  }

  onSearch(v: string): void { this.search.set(v); this.page.set(1); this.load(); }
  onStatus(v: string): void { this.status.set(v); this.page.set(1); this.load(); }
  prevPage(): void { if (this.page() > 1)               { this.page.update(p => p - 1); this.load(); } }
  nextPage(): void { if (this.page() < this.totalPages()) { this.page.update(p => p + 1); this.load(); } }

  openDetail(b: ApiBooking): void {
    this.selected.set(b);
    this.newStatus.set(b.status);
    this.error.set('');
    this.modalOpen.set(true);
  }
  closeModal(): void { this.modalOpen.set(false); }

  updateStatus(): void {
    const b = this.selected();
    if (!b) return;
    this.saving.set(true);
    this.bookingApi.updateStatus(b._id, this.newStatus() as ApiBooking['status']).subscribe({
      next: (res) => {
        this.saving.set(false);
        this.selected.set(res.data);
        this.success.set('Đã cập nhật trạng thái!');
        setTimeout(() => this.success.set(''), 3000);
        this.load();
      },
      error: (err) => { this.saving.set(false); this.error.set(err.error?.message || 'Cập nhật thất bại.'); },
    });
  }
}
