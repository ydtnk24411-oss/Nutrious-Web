import { Component, OnInit, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import {
  ReviewAdminApiService,
  AdminReviewItem,
  ReviewAdminStats,
} from '../../shared/services/review-admin-api.service';

@Component({
  selector: 'app-admin-reviews',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './reviews.component.html',
  styleUrl: './reviews.component.css',
})
export class AdminReviewsComponent implements OnInit {
  private reviewApi = inject(ReviewAdminApiService);

  reviews = signal<AdminReviewItem[]>([]);
  stats = signal<ReviewAdminStats>({
    total: 0,
    averageRating: 0,
    ratingDistribution: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
    pendingReplyCount: 0,
  });

  loading = signal(false);
  searchQuery = signal('');
  selectedRating = signal<number | 'all'>('all');
  selectedStatus = signal<'all' | 'visible' | 'hidden'>('all');

  // Modal Reply
  replyModalOpen = signal(false);
  activeReview = signal<AdminReviewItem | null>(null);
  replyContent = signal('');
  submittingReply = signal(false);

  ngOnInit(): void {
    this.loadReviews();
  }

  loadReviews(): void {
    this.loading.set(true);
    const params: Record<string, string | number> = { limit: 50 };
    if (this.searchQuery()) params['search'] = this.searchQuery();
    if (this.selectedRating() !== 'all') params['rating'] = this.selectedRating();
    if (this.selectedStatus() !== 'all') params['status'] = this.selectedStatus();

    this.reviewApi.getAll(params).subscribe({
      next: (res) => {
        if (res.success) {
          this.reviews.set(res.data);
          if (res.stats) this.stats.set(res.stats);
        }
        this.loading.set(false);
      },
      error: () => this.loading.set(false),
    });
  }

  openReplyModal(item: AdminReviewItem): void {
    this.activeReview.set(item);
    this.replyContent.set(item.adminReply || '');
    this.replyModalOpen.set(true);
  }

  closeReplyModal(): void {
    this.replyModalOpen.set(false);
    this.activeReview.set(null);
  }

  submitReply(): void {
    const item = this.activeReview();
    if (!item) return;

    this.submittingReply.set(true);
    this.reviewApi.reply(item._id, this.replyContent()).subscribe({
      next: (res) => {
        this.submittingReply.set(false);
        if (res.success) {
          this.closeReplyModal();
          this.loadReviews();
        }
      },
      error: () => {
        this.submittingReply.set(false);
        alert('Không thể lưu phản hồi. Vui lòng thử lại.');
      },
    });
  }

  
  getUserAvatar(item: AdminReviewItem | null | undefined): string {
    if (!item) return '';
    if (item.userAvatar) return item.userAvatar;
    if (item.user && typeof item.user === 'object' && item.user.avatar) {
      return item.user.avatar;
    }
    return '';
  }

  toggleHideReview(item: AdminReviewItem): void {
    const newHidden = !item.isHidden;
    const confirmMsg = newHidden
      ? `Bạn có chắc chắn muốn ẩn đánh giá này khỏi website?`
      : `Cho phép hiển thị lại đánh giá này trên website?`;

    if (!confirm(confirmMsg)) return;

    this.reviewApi.toggleHide(item._id, newHidden).subscribe({
      next: (res) => {
        if (res.success) {
          this.loadReviews();
        }
      },
      error: () => alert('Lỗi khi cập nhật trạng thái hiển thị.'),
    });
  }
}

