import { Injectable, signal, inject } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';
import { ApiService } from './api.service';
import { tap } from 'rxjs/operators';

export interface AdminUser {
  _id: string;
  name: string;
  email: string;
  role: string;
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

  login(email: string, password: string) {
    return this.api.post<{ success: boolean; token: string; user: AdminUser }>(
      '/auth/login', { email, password }
    ).pipe(
      tap(res => {
        if (res.success && res.user.role === 'admin') {
          localStorage.setItem(TOKEN_KEY, res.token);
          localStorage.setItem(USER_KEY, JSON.stringify(res.user));  // ← lưu user
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
      const raw = localStorage.getItem(USER_KEY);  // ← đọc đúng key
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  }
}
