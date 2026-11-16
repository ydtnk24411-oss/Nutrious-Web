import { Component, OnInit, OnDestroy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { of } from 'rxjs';
import { timeout, catchError, finalize } from 'rxjs/operators';
import {
  SupportApiService,
  SupportConversation,
  ConversationStatus,
  SupportStats,
} from '../../shared/services/support-api.service';
import { AdminAuthService } from '../../shared/services/admin-auth.service';

@Component({
  selector: 'app-admin-support',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './support.component.html',
  styleUrl: './support.component.css',
})
export class AdminSupportComponent implements OnInit, OnDestroy {
  private supportApi = inject(SupportApiService);
  protected auth = inject(AdminAuthService);

  conversations = signal<SupportConversation[]>([]);
  activeConversation = signal<SupportConversation | null>(null);
  stats = signal<SupportStats>({
    total: 0,
    waitingForAdmin: 0,
    adminProcessing: 0,
    aiProcessing: 0,
    resolved: 0,
  });

  statusFilter = signal<string>('all');
  searchQuery = signal<string>('');
  replyText = signal<string>('');
  loading = signal(false);
  sending = signal(false);
  hasError = signal(false);
  errorMessage = signal<string>('');
  pollTimer: any = null;
  private isRefreshing = false;

  ngOnInit(): void {
    this.loadConversations();
    // Polling every 6 seconds for live sync with customer chatbot without overloading network
    this.pollTimer = setInterval(() => {
      this.refreshQuietly();
    }, 6000);
  }

  ngOnDestroy(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
    }
  }

  loadConversations(selectFirst = true): void {
    this.loading.set(true);
    this.hasError.set(false);
    this.errorMessage.set('');
    const params: Record<string, string | number> = {};
    if (this.statusFilter() !== 'all') params['status'] = this.statusFilter();
    if (this.searchQuery()) params['search'] = this.searchQuery();

    this.supportApi
      .getConversations(params)
      .pipe(
        timeout(6000),
        finalize(() => this.loading.set(false)),
        catchError((err) => {
          console.warn('Lỗi khi tải danh sách hội thoại:', err);
          this.hasError.set(true);
          const isTimeout = err?.name === 'TimeoutError' || err?.message?.includes('Timeout');
          const msg = isTimeout
            ? 'Không thể tải danh sách hội thoại (Quá thời gian phản hồi)'
            : (err?.error?.message || 'Không thể tải danh sách hội thoại. Vui lòng thử lại.');
          this.errorMessage.set(msg);
          return of(null);
        })
      )
      .subscribe({
        next: (res) => {
          if (res && res.success) {
            this.conversations.set(res.data || []);
            if (res.stats) this.stats.set(res.stats);

            // Maintain active conversation selection
            const currentId = this.activeConversation()?._id;
            if (currentId) {
              const found = (res.data || []).find((c) => c._id === currentId);
              if (found) this.activeConversation.set(found);
            } else if (selectFirst && res.data && res.data.length > 0) {
              this.selectConversation(res.data[0]);
            }
          }
        },
      });
  }

  retryLoad(): void {
    this.loadConversations(true);
  }

  refreshQuietly(): void {
    if (this.isRefreshing) return; // Prevent concurrent requests stacking
    this.isRefreshing = true;

    const params: Record<string, string | number> = {};
    if (this.statusFilter() !== 'all') params['status'] = this.statusFilter();
    if (this.searchQuery()) params['search'] = this.searchQuery();

    this.supportApi
      .getConversations(params)
      .pipe(
        timeout(6000),
        finalize(() => { this.isRefreshing = false; }),
        catchError(() => of(null))
      )
      .subscribe({
        next: (res) => {
          if (res && res.success) {
            this.conversations.set(res.data || []);
            if (res.stats) this.stats.set(res.stats);

            const currentId = this.activeConversation()?._id;
            if (currentId) {
              const found = (res.data || []).find((c) => c._id === currentId);
              if (found) {
                const current = this.activeConversation();
                // Preserve messages if active conversation already loaded them
                this.activeConversation.set({
                  ...found,
                  messages: current?.messages?.length ? current.messages : found.messages,
                });
              }
            }
          }
        },
      });
  }

  selectConversation(conv: SupportConversation): void {
    this.activeConversation.set(conv);
    this.supportApi.getConversationById(conv._id).subscribe({
      next: (res) => {
        if (res.success) {
          this.activeConversation.set(res.data);
        }
      },
    });
  }

  setStatusFilter(status: string): void {
    this.statusFilter.set(status);
    this.loadConversations(true);
  }

  assignToMe(): void {
    const current = this.activeConversation();
    if (!current) return;

    this.supportApi.assignToMe(current._id).subscribe({
      next: (res) => {
        if (res.success) {
          this.activeConversation.set(res.data);
          this.refreshQuietly();
        }
      },
    });
  }

  updateStatus(status: ConversationStatus): void {
    const current = this.activeConversation();
    if (!current) return;

    this.supportApi.updateStatus(current._id, status).subscribe({
      next: (res) => {
        if (res.success) {
          this.activeConversation.set(res.data);
          this.refreshQuietly();
        }
      },
    });
  }

  onTextareaKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.sendReply();
    }
  }

  sendReply(): void {
    const text = this.replyText().trim();
    const current = this.activeConversation();
    if (!text || !current || this.sending()) return;

    this.sending.set(true);
    const timeoutHandle = setTimeout(() => {
      if (this.sending()) {
        this.sending.set(false);
      }
    }, 15000);

    this.supportApi.sendAdminReply(current._id, text).subscribe({
      next: (res) => {
        clearTimeout(timeoutHandle);
        this.sending.set(false);
        this.replyText.set('');
        if (res.success) {
          this.activeConversation.set(res.data);
          this.refreshQuietly();
        }
      },
      error: (err) => {
        clearTimeout(timeoutHandle);
        this.sending.set(false);
        alert(err.error?.message || 'Không thể gửi tin nhắn. Vui lòng thử lại.');
      },
    });
  }

  getCustomerAvatar(conv: SupportConversation | null | undefined): string {
    if (!conv) return '';
    return conv.customer?.avatar || conv.customerAvatar || '';
  }

  getStatusBadge(status: ConversationStatus): { text: string; cssClass: string } {
    switch (status) {
      case 'WAITING_FOR_ADMIN':
        return { text: 'Chờ tiếp nhận', cssClass: 'badge-waiting' };
      case 'ADMIN_PROCESSING':
        return { text: 'Nhân viên đang hỗ trợ', cssClass: 'badge-admin' };
      case 'AI_PROCESSING':
        return { text: 'AI đang hỗ trợ', cssClass: 'badge-ai' };
      case 'RESOLVED':
        return { text: 'Đã hoàn tất', cssClass: 'badge-resolved' };
      default:
        return { text: status, cssClass: '' };
    }
  }
}

