import { Injectable, signal, inject } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { ApiService } from './api.service';
import { tap } from 'rxjs/operators';

export interface AdminUser {
  _id: string;
  name: string;
  email: string;
  role: string;
  avatar?: string;
  phone?: string;
  assignedStore?: string;
  storeName?: string;
  points?: number;
  tier?: string;
  totalSpent?: number;
  addresses?: any[];
  createdAt?: Date;
  updatedAt?: Date;
  __v?: number;
}

const TOKEN_KEY = 'xanhla_admin_token';
const USER_KEY  = 'xanhla_admin_user';

@Injectable({ providedIn: 'root' })
export class AdminAuthService {
  private api    = inject(ApiService);
  private router = inject(Router);

  private _user  = signal<AdminUser | null>(this._loadUser());
  private _token = signal<string | null>(localStorage.getItem(TOKEN_KEY));

  readonly user      = this._user.asReadonly();
  readonly token     = this._token.asReadonly();
  readonly isLoggedIn = () => !!this._token();

  constructor() {
    this.refreshProfile();
  }

  refreshProfile(): void {
    if (!this._token()) return;
    this.api.get<{ success: boolean; user: AdminUser }>('/auth/me').subscribe({
      next: (res) => {
        if (res.success && res.user) {
          localStorage.setItem(USER_KEY, JSON.stringify(res.user));
          this._user.set(res.user);
        }
      },
      error: () => {}
    });
  }

  login(email: string, password: string) {
    return this.api.post<{ success: boolean; token: string; user: AdminUser }>(
      '/auth/login-emp', { username: email.trim(), email: email.trim(), password }
    ).pipe(
      tap(res => {
        const role = (res.user?.role || '').toLowerCase();
        const allowedRoles = ['admin', 'manager', 'sales', 'warehouse', 'marketing', 'support', 'content'];
        if (res.success && allowedRoles.includes(role)) {
          localStorage.setItem(TOKEN_KEY, res.token);
          localStorage.setItem(USER_KEY, JSON.stringify(res.user));  // ← lưu user
          this._token.set(res.token);
          this._user.set(res.user);
        }
      })
    );
  }

  loginWithGoogle(data: { credential?: string; accessToken?: string }) {
    return this.api.post<{
      success: boolean;
      token: string;
      user: AdminUser;
      isNewUser?: boolean;
      message?: string;
    }>('/auth/google', { ...data, forAdmin: true }).pipe(
      tap(res => {
        const role = (res.user?.role || '').toLowerCase();
        if (res.success && ['admin', 'manager', 'sales', 'warehouse', 'marketing', 'support', 'content'].includes(role)) {
          localStorage.setItem(TOKEN_KEY, res.token);
          localStorage.setItem(USER_KEY, JSON.stringify(res.user));
          this._token.set(res.token);
          this._user.set(res.user);
        }
      })
    );
  }

  logout(): void {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    this._token.set(null);
    this._user.set(null);
    this.router.navigate(['/admin/login']);
  }

  private _loadUser(): AdminUser | null {
    try {
      const raw = localStorage.getItem(USER_KEY);
      if (!raw) return null;
      const u = JSON.parse(raw);
      if (u) {
        const role = (u.role || '').toLowerCase();
        if (role === 'marketing' && (/marketing/i.test(u.name) || !u.name)) {
          u.name = 'Phạm Thị Hồng Hạnh';
        } else if (role === 'sales' && (/bán hàng|sales/i.test(u.name) || !u.name)) {
          u.name = 'Lê Thị Thu Thảo';
        } else if (role === 'warehouse' && (/kho|warehouse/i.test(u.name) || !u.name)) {
          u.name = 'Nguyễn Văn Khoa';
        }
        if (u.name) {
          u.name = u.name.replace(/\s*\([^)]*\)$/, '').trim();
        }
        localStorage.setItem(USER_KEY, JSON.stringify(u));
      }
      return u;
    } catch { return null; }
  }
}
