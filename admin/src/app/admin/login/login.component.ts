import { Component, signal, inject, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CookieService } from 'ngx-cookie-service';
import { AdminAuthService } from '../../shared/services/admin-auth.service';
import { GoogleAuthService } from '../../shared/services/google-auth.service';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class AdminLoginComponent implements OnInit {
  private auth  = inject(AdminAuthService);
  private googleAuth = inject(GoogleAuthService);
  private router = inject(Router);
  private route  = inject(ActivatedRoute);
  private cookieService = inject(CookieService);

  email      = signal('admin@xanhla.farm');
  password   = signal('admin123');
  rememberMe = signal(true);
  loading    = signal(false);
  googleLoading = signal(false);
  error      = signal('');
  expired    = signal(false);  // ← hiện banner token hết hạn

  ngOnInit(): void {
    // Kiểm tra query param ?expired=1 do interceptor redirect
    this.expired.set(this.route.snapshot.queryParamMap.get('expired') === '1');
    
    // Ghi nhớ tài khoản: Đọc tên đăng nhập từ Cookie nếu có
    const savedUsername = this.cookieService.get('admin_remembered_username');
    if (savedUsername) {
      this.email.set(savedUsername);
      this.rememberMe.set(true);
    }

    // Nếu đã đăng nhập hợp lệ thì redirect về dashboard luôn
    if (this.auth.isLoggedIn()) {
      this.router.navigate(['/admin/dashboard']);
    }
  }

  submit(e: Event): void {
    e.preventDefault();
    if (!this.email() || !this.password()) return;

    this.loading.set(true);
    this.error.set('');
    this.expired.set(false);

    this.auth.login(this.email(), this.password()).subscribe({
      next: (res) => {
        this.loading.set(false);
        const role = (res.user?.role || '').toLowerCase();
        if (res.success && (role === 'sales' || role === 'admin')) {
          // Ghi nhớ tên đăng nhập bằng cookie
          if (this.rememberMe()) {
            this.cookieService.set('admin_remembered_username', this.email().trim(), 30, '/');
          } else {
            this.cookieService.delete('admin_remembered_username', '/');
          }
          this.router.navigate(['/admin/dashboard']);
        } else {
          const errMsg = 'Tài khoản không có quyền nhân viên bán hàng (Sales/Admin).';
          this.error.set(errMsg);
          this.router.navigate(['/admin/login-failed'], {
            queryParams: { reason: 'unauthorized', message: errMsg },
          });
        }
      },
      error: (err) => {
        this.loading.set(false);
        const errMsg = err.error?.message || 'Đăng nhập thất bại. Vui lòng kiểm tra lại thông tin.';
        this.error.set(errMsg);
        this.router.navigate(['/admin/login-failed'], {
          queryParams: { reason: 'auth_failed', message: errMsg },
        });
      },
    });
  }

  loginWithGoogle(): void {
    this.googleLoading.set(true);
    this.error.set('');
    this.googleAuth.promptSignIn(
      (data) => {
        this.auth.loginWithGoogle(data).subscribe({
          next: (res) => {
            this.googleLoading.set(false);
            if (res.success && ['admin', 'sales', 'warehouse', 'support', 'content'].includes(res.user.role)) {
              this.router.navigate(['/admin/dashboard']);
            } else {
              this.error.set('Tài khoản Google này không có quyền truy cập trang quản trị.');
            }
          },
          error: (err) => {
            this.googleLoading.set(false);
            this.error.set(err.error?.message || 'Đăng nhập Google thất bại.');
          }
        });
      },
      (errorMsg) => {
        this.googleLoading.set(false);
        this.error.set(errorMsg);
      }
    );
  }
}
