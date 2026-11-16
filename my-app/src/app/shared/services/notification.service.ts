import { Injectable, signal, computed, inject } from '@angular/core';
import { ApiService } from './api.service';
import { CartService } from './cart.service';

export interface InAppNotification {
  id: string;
  title: string;
  body: string;
  type: string;
  path: string;
  unread: boolean;
  createdAt: string;
}

@Injectable({ providedIn: 'root' })
export class NotificationService {
  private api = inject(ApiService);
  private cart = inject(CartService);

  private _notifications = signal<InAppNotification[]>([]);
  private eventSource: EventSource | null = null;

  readonly notifications = this._notifications.asReadonly();
  readonly unreadCount = computed(() => this._notifications().filter(n => n.unread).length);

  constructor() {
    this.loadHistory();
    this.connectSse();
  }

  loadHistory(): void {
    this.api.get<{ success: boolean; unreadCount: number; data: InAppNotification[] }>('/notifications').subscribe({
      next: (res) => {
        if (res.success && Array.isArray(res.data)) {
          this._notifications.set(res.data);
        }
      },
      error: () => {},
    });
  }

  connectSse(): void {
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') return;

    try {
      const user = this.cart.currentUser();
      const query = user ? `?userId=${user._id}&role=${user.role || 'customer'}` : '';
      const streamUrl = `http://localhost:3000/api/notifications/stream${query}`;

      if (this.eventSource) {
        this.eventSource.close();
      }

      this.eventSource = new EventSource(streamUrl);

      this.eventSource.onmessage = (event) => {
        if (!event.data || event.data.startsWith(':')) return;
        try {
          const parsed = JSON.parse(event.data);
          if (parsed && parsed.title) {
            this._notifications.update(list => [parsed, ...list.filter(n => n.id !== parsed.id)]);
          }
        } catch {}
      };

      this.eventSource.onerror = () => {
        // EventSource will automatically attempt reconnection
      };
    } catch {}
  }

  markAllAsRead(): void {
    this._notifications.update(items => items.map(n => ({ ...n, unread: false })));
    this.api.put('/notifications/read-all', {}).subscribe();
  }

  markAsRead(id: string): void {
    this._notifications.update(items => items.map(n => n.id === id ? { ...n, unread: false } : n));
    this.api.put(`/notifications/${id}/read`, {}).subscribe();
  }
}
