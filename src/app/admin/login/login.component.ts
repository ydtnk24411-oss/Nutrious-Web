import { Component, signal, inject, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { AdminAuthService } from '../../shared/services/admin-auth.service';

@Component({
  selector: 'app-admin-login',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './login.component.html',
  styleUrl: './login.component.css',
})
export class AdminLoginComponent implements OnInit {
  private auth  = inject(AdminAuthService);
  private router = inject(Router);
  private route  = inject(ActivatedRoute);

  email    = signal('admin@xanhla.farm');
  password = signal('admin123');
  loading  = signal(false);
  error    = signal('');
  expired  = signal(false);  // ← hiện banner token hết hạn

  ngOnInit(): void {
    // Kiểm tra query param ?expired=1 do interceptor redirect
    this.expired.set(this.route.snapshot.queryParamMap.get('expired') === '1');
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
        if (res.success && res.user.role === 'admin') {
          this.router.navigate(['/admin/dashboard']);
        } else {
          this.error.set('Tài khoản không có quyền admin.');
        }
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err.error?.message || 'Đăng nhập thất bại.');
      },
    });
  }
}
