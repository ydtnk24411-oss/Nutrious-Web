import { Component, signal, inject, OnInit, computed } from '@angular/core';
import { RouterLink } from '@angular/router';
import { CommonModule } from '@angular/common';
import { ShellComponent } from '../../components/shell/shell.component';
import { EventApiService, ApiEvent } from '../../shared/services/event-api.service';

@Component({
  selector: 'app-events',
  standalone: true,
  imports: [CommonModule, ShellComponent, RouterLink],
  templateUrl: './events.component.html',
  styleUrl: './events.component.css',
})
export class EventsComponent implements OnInit {
  private eventApi = inject(EventApiService);

  events  = signal<ApiEvent[]>([]);
  loading = signal(true);
  error   = signal('');

  ngOnInit(): void {
    this.eventApi.getAll().subscribe({
      next:  (res) => { this.events.set(res.data); this.loading.set(false); },
      error: ()    => { this.error.set('Không thể tải sự kiện.'); this.loading.set(false); },
    });
  }

  eventSlug(ev: ApiEvent): string {
    return ev.slug.startsWith('/') ? ev.slug : `/event-details/${ev.slug}`;
  }

  upcomingCount(): number {
    return this.events().filter(e => e.isActive).length;
  }
}
