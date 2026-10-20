import { Component, signal, inject, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ShellComponent } from '../../components/shell/shell.component';
import { CartService } from '../../shared/services/cart.service';
import { ServiceApiService, ApiService2 } from '../../shared/services/service-api.service';
import { BookingApiService } from '../../shared/services/booking-api.service';

@Component({
  selector: 'app-service-detail',
  standalone: true,
  imports: [CommonModule, ShellComponent, RouterLink],
  templateUrl: './service-detail.component.html',
  styleUrl: './service-detail.component.css',
})
export class ServiceDetailComponent implements OnInit {
  protected cart       = inject(CartService);
  private route        = inject(ActivatedRoute);
  private serviceApi   = inject(ServiceApiService);
  private bookingApi   = inject(BookingApiService);

  protected service     = signal<ApiService2 | null>(null);
  protected loading     = signal(true);
  protected error       = signal('');
  protected booked      = signal(false);
  protected submitting  = signal(false);
  protected bookError   = signal('');
  protected selectedDate = signal('2026-10-25');
  protected selectedTime = signal('10:00 AM');

  ngOnInit(): void {
    const slug = this.route.snapshot.paramMap.get('slug') ?? '';
    this.serviceApi.getBySlug(slug).subscribe({
      next: (res) => { this.service.set(res.data); this.loading.set(false); },
      error: () => { this.error.set('Không tìm thấy dịch vụ.'); this.loading.set(false); },
    });
  }

  handleBooking(e: Event): void {
    e.preventDefault();
    const svc = this.service();
    if (!svc) return;
    if (svc.status === 'Đã kết thúc') return;

    const u = this.cart.currentUser();
    this.submitting.set(true);
    this.bookError.set('');

    this.bookingApi.create({
      service: svc._id,
      serviceName: svc.name,
      guestName:  u?.name  ?? 'Khách',
      guestEmail: u?.email ?? '',
      guestPhone: u?.phone ?? '',
      date: this.selectedDate(),
      time: this.selectedTime(),
    } as any).subscribe({
      next: () => { this.submitting.set(false); this.booked.set(true); },
      error: (err) => {
        this.submitting.set(false);
        this.bookError.set(err.error?.message || 'Đặt lịch thất bại, vui lòng thử lại.');
      },
    });
  }
}
