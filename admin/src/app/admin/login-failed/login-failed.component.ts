import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterLink } from '@angular/router';

@Component({
  selector: 'app-admin-login-failed',
  standalone: true,
  imports: [CommonModule, RouterLink],
  template: `
    <div style="min-height: 100vh; display: flex; align-items: center; justify-content: center; background: #f4f7f5; padding: 20px;">
      <div style="background: #ffffff; border: 1px solid #dce5df; border-radius: 16px; padding: 36px 32px; max-width: 440px; width: 100%; text-align: center; box-shadow: 0 10px 25px rgba(20, 83, 45, 0.08);">
        <div style="width: 56px; height: 56px; margin: 0 auto 16px; background: #fee2e2; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #dc2626;">
          <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="8" x2="12" y2="12"></line>
            <line x1="12" y1="16" x2="12.01" y2="16"></line>
          </svg>
        </div>
        <h2 style="font-size: 20px; font-weight: 800; color: #1c2920; margin: 0 0 8px;">Truy cập bị từ chối</h2>
        <p style="font-size: 14px; color: #5d6f64; line-height: 1.5; margin: 0 0 24px;">
          {{ errorMessage }}
        </p>
        <div style="display: flex; gap: 10px; justify-content: center;">
          <a routerLink="/admin/login" style="display: inline-flex; align-items: center; justify-content: center; padding: 10px 20px; background: #14532d; color: #ffffff; font-size: 13.5px; font-weight: 700; border-radius: 10px; text-decoration: none;">
            Đăng nhập lại
          </a>
        </div>
      </div>
    </div>
  `,
})
export class AdminLoginFailedComponent {
  private route = inject(ActivatedRoute);

  get errorMessage(): string {
    return this.route.snapshot.queryParams['message'] || 'Bạn không có quyền hạn nhân viên bán hàng (Sales) để truy cập khu vực quản trị này.';
  }
}
