import { Component, OnInit, OnDestroy, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
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
  pollTimer: any = null;

  ngOnInit(): void {
    this.loadConversations();
    // Polling every 5 seconds for incoming live messages
    this.pollTimer = setInterval(() => {
      this.refreshQuietly();
    }, 5000);
  }

  ngOnDestroy(): void {
    if (this.pollTimer) {
      clearInterval(this.pollTimer);
    }
  }

  loadConversations(selectFirst = true): void {
    this.loading.set(true);
    const params: Record<string, string | number> = {};
    if (this.statusFilter() !== 'all') params['status'] = this.statusFilter();
    if (this.searchQuery()) params['search'] = this.searchQuery();

    this.supportApi.getConversations(params).subscribe({
      next: (res) => {
        if (res.success) {
          this.conversations.set(res.data);
          if (res.stats) this.stats.set(res.stats);

          // Maintain active conversation selection
          const currentId = this.activeConversation()?._id;
          if (currentId) {
            const found = res.data.find((c) => c._id === currentId);
            if (found) this.activeConversation.set(found);
          } else if (selectFirst && res.data.length > 0) {
            this.selectConversation(res.data[0]);
          }
        }
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  refreshQuietly(): void {
    const params: Record<string, string | number> = {};
    if (this.statusFilter() !== 'all') params['status'] = this.statusFilter();
    if (this.searchQuery()) params['search'] = this.searchQuery();

    this.supportApi.getConversations(params).subscribe({
      next: (res) => {
        if (res.success) {
          this.conversations.set(res.data);
          if (res.stats) this.stats.set(res.stats);

          const currentId = this.activeConversation()?._id;
          if (currentId) {
            const found = res.data.find((c) => c._id === currentId);
            if (found) this.activeConversation.set(found);
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

  sendReply(): void {
    const text = this.replyText().trim();
    const current = this.activeConversation();
    if (!text || !current || this.sending()) return;

    this.sending.set(true);
    this.supportApi.sendAdminReply(current._id, text).subscribe({
      next: (res) => {
        this.sending.set(false);
        this.replyText.set('');
        if (res.success) {
          this.activeConversation.set(res.data);
          this.refreshQuietly();
        }
      },
      error: () => {
        this.sending.set(false);
        alert('Không thể gửi tin nhắn. Vui lòng thử lại.');
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

