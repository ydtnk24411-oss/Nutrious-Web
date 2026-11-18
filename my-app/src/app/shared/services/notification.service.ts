import { Injectable, signal, computed, inject, effect, OnDestroy } from '@angular/core';
import { ApiService, API_BASE } from './api.service';
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
export class NotificationService implements OnDestroy {
  private api = inject(ApiService);
  private cart = inject(CartService);

  private _notifications = signal<InAppNotification[]>([]);
  private eventSource: EventSource | null = null;
  private pollTimer: any = null;

  readonly notifications = this._notifications.asReadonly();
  readonly unreadCount = computed(() => this._notifications().filter(n => n.unread).length);

  constructor() {
    // 1. Tự động tải lại lịch sử thông báo và tái kết nối SSE mỗi khi phiên đăng nhập của người dùng thay đổi
    effect(() => {
      // Đọc signal currentUser để effect tự động kích hoạt lại khi đăng nhập / đăng xuất
      const user = this.cart.currentUser();
      this.loadHistory();
      this.connectSse();
    });

    // 2. Cơ chế đối soát ngầm định kỳ (polling mỗi 15 giây) dự phòng trường hợp kết nối mạng bị gián đoạn
    if (typeof window !== 'undefined') {
      this.pollTimer = setInterval(() => {
        this.loadHistory();
      }, 15000);
    }
  }

  ngOnDestroy(): void {
    if (this.eventSource) {
      this.eventSource.close();
      this.eventSource = null;
    }
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
      this.pollTimer = null;
    }
  }

  loadHistory(): void {
    this.api.get<{ success: boolean; unreadCount: number; data: any[] }>('/notifications').subscribe({
      next: (res) => {
        if (res.success && Array.isArray(res.data)) {
          const mapped: InAppNotification[] = res.data.map(item => ({
            id: String(item.id || item._id || ''),
            title: item.title || '',
            body: item.body || '',
            type: item.type || 'order',
            path: item.path || '/account?tab=orders',
            unread: item.unread !== false,
            createdAt: item.createdAt || new Date().toISOString(),
          }));
          this._notifications.set(mapped);
        }
      },
      error: () => {},
    });
  }

  connectSse(): void {
    if (typeof window === 'undefined' || typeof EventSource === 'undefined') return;

    try {
      if (this.eventSource) {
        this.eventSource.close();
        this.eventSource = null;
      }

      const user = this.cart.currentUser();
      const userId = user ? String(user._id || (user as any).id || '') : '';
      const token = typeof localStorage !== 'undefined' ? (localStorage.getItem('xanhla_auth_token') || '') : '';

      const params = new URLSearchParams();
      if (userId) params.set('userId', userId);
      if (user?.role) params.set('role', user.role);
      if (token) params.set('token', token);

      const qs = params.toString();
      const streamUrl = `${API_BASE}/notifications/stream${qs ? '?' + qs : ''}`;

      this.eventSource = new EventSource(streamUrl);

      this.eventSource.onmessage = (event) => {
        if (!event.data || event.data.startsWith(':')) return;
        try {
          const parsed = JSON.parse(event.data);
          if (parsed && parsed.title) {
            const item: InAppNotification = {
              id: String(parsed.id || parsed._id || ''),
              title: parsed.title,
              body: parsed.body,
              type: parsed.type || 'order',
              path: parsed.path || '/account?tab=orders',
              unread: parsed.unread !== false,
              createdAt: parsed.createdAt || new Date().toISOString(),
            };
            this._notifications.update(list => [item, ...list.filter(n => n.id !== item.id)]);
          }
        } catch {}
      };

      this.eventSource.onerror = () => {
        // EventSource sẽ tự động kết nối lại khi có kết nối mạng
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
