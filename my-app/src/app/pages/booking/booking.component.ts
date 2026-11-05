import { Component, signal, inject, OnInit } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ShellComponent } from '../../components/shell/shell.component';
import { ServiceApiService, ApiService2 } from '../../shared/services/service-api.service';

@Component({
  selector: 'app-booking',
  standalone: true,
  imports: [CommonModule, ShellComponent, RouterLink],
  templateUrl: './booking.component.html',
  styleUrl: './booking.component.css',
})
export class BookingComponent implements OnInit {
  private serviceApi = inject(ServiceApiService);

  protected services = signal<ApiService2[]>([]);
  protected loading  = signal(true);
  protected error    = signal('');

  ngOnInit(): void {
    this.serviceApi.getAll().subscribe({
      next:  (res) => { this.services.set(res.data); this.loading.set(false); },
      error: ()    => { this.error.set('Không thể tải dịch vụ.'); this.loading.set(false); },
    });
  }

  serviceSlug(svc: ApiService2): string {
    return svc.slug.startsWith('/') ? svc.slug : `/service-page/${svc.slug}`;
  }
}
