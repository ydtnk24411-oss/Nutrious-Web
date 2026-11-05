import { Component, signal, inject, OnInit } from '@angular/core';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ShellComponent } from '../../components/shell/shell.component';
import { CartService } from '../../shared/services/cart.service';
import { EventApiService, ApiEvent } from '../../shared/services/event-api.service';

@Component({
  selector: 'app-event-detail',
  standalone: true,
  imports: [CommonModule, ShellComponent, RouterLink],
  templateUrl: './event-detail.component.html',
  styleUrl: './event-detail.component.css',
})
export class EventDetailComponent implements OnInit {
  protected cart      = inject(CartService);
  private route       = inject(ActivatedRoute);
  private eventApi    = inject(EventApiService);

  protected event      = signal<ApiEvent | null>(null);
  protected loading    = signal(true);
  protected error      = signal('');
  protected registered = signal(false);
  protected submitting = signal(false);
  protected regError   = signal('');
  protected fullName   = signal('');
  protected email      = signal('');
  protected phone      = signal('');

  ngOnInit(): void {
    const slug = this.route.snapshot.paramMap.get('slug') ?? '';
    this.eventApi.getBySlug(slug).subscribe({
      next: (res) => { this.event.set(res.data); this.loading.set(false); },
      error: () => { this.error.set('Không tìm thấy sự kiện.'); this.loading.set(false); },
    });
    // Pre-fill từ user đang đăng nhập
    const u = this.cart.currentUser();
    if (u) {
      this.fullName.set(u.name ?? '');
      this.email.set(u.email ?? '');
      this.phone.set(u.phone ?? '');
    }
  }

  handleRegister(e: Event): void {
    e.preventDefault();
    const ev = this.event();
    if (!ev) return;

    this.submitting.set(true);
    this.regError.set('');

    const slug = ev.slug.replace(/^\/event-details\//, '');
    this.eventApi.register(slug, {
      name:  this.fullName(),
      email: this.email(),
      phone: this.phone() || undefined,
    }).subscribe({
      next: () => { this.submitting.set(false); this.registered.set(true); },
      error: (err) => {
        this.submitting.set(false);
        this.regError.set(err.error?.message || 'Đăng ký thất bại, vui lòng thử lại.');
      },
    });
  }
}
