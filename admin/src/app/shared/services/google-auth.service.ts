import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from './api.service';

declare const google: any;

export const DEFAULT_GOOGLE_CLIENT_ID = '188871008521-46hp48f411gfkh501b0g6rvvj6g5n31n.apps.googleusercontent.com';

@Injectable({
  providedIn: 'root'
})
export class GoogleAuthService {
  private api = inject(ApiService);

  clientId = signal<string>(this.getStoredClientId());
  private isConfigLoaded = false;

  constructor() {
    this.loadServerConfig();
  }

  private getStoredClientId(): string {
    try {
      return localStorage.getItem('GOOGLE_CLIENT_ID') || DEFAULT_GOOGLE_CLIENT_ID;
    } catch {
      return DEFAULT_GOOGLE_CLIENT_ID;
    }
  }

  /** Tải Google Client ID từ server nếu đã cấu hình trong .env */
  loadServerConfig(): void {
    if (this.isConfigLoaded) return;
    this.api.get<{ success: boolean; googleClientId?: string }>('/auth/config').subscribe({
      next: (res) => {
        if (res?.success && res.googleClientId) {
          this.clientId.set(res.googleClientId);
          try {
            localStorage.setItem('GOOGLE_CLIENT_ID', res.googleClientId);
          } catch {}
        }
        this.isConfigLoaded = true;
      },
      error: () => {
        this.isConfigLoaded = true;
      }
    });
  }

  /** Lưu hoặc cập nhật Google Client ID */
  setClientId(id: string): void {
    const clean = id.trim();
    this.clientId.set(clean);
    try {
      if (clean) {
        localStorage.setItem('GOOGLE_CLIENT_ID', clean);
      } else {
        localStorage.removeItem('GOOGLE_CLIENT_ID');
      }
    } catch {}
  }

  /** Đảm bảo Google Identity Services script đã sẵn sàng */
  async waitForGoogleScript(timeoutMs = 5000): Promise<boolean> {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      if (typeof google !== 'undefined' && google?.accounts) {
        return true;
      }
      await new Promise(r => setTimeout(r, 100));
    }
    return typeof google !== 'undefined' && !!google?.accounts;
  }

  /** Khởi tạo Google One-tap / ID Token listener */
  async initIdListener(onCredential: (credential: string) => void): Promise<boolean> {
    const ready = await this.waitForGoogleScript();
    if (!ready) {
      console.warn('Google Identity Services script chưa được tải.');
      return false;
    }

    const cid = this.clientId();
    if (!cid) return false;

    try {
      google.accounts.id.initialize({
        client_id: cid,
        callback: (res: any) => {
          if (res?.credential) {
            onCredential(res.credential);
          }
        },
        auto_select: false,
        cancel_on_tap_outside: true,
      });
      return true;
    } catch (err) {
      console.error('Lỗi khởi tạo Google Identity Services:', err);
      return false;
    }
  }

  /** Render nút Google chính thức vào phần tử HTML */
  async renderButton(
    container: HTMLElement,
    onCredential: (credential: string) => void,
    options: Record<string, any> = {}
  ): Promise<boolean> {
    const initialized = await this.initIdListener(onCredential);
    if (!initialized || !container) return false;

    try {
      google.accounts.id.renderButton(container, {
        theme: 'outline',
        size: 'large',
        width: 340,
        text: 'continue_with',
        shape: 'rectangular',
        logo_alignment: 'left',
        ...options,
      });
      return true;
    } catch (err) {
      console.error('Lỗi render Google button:', err);
      return false;
    }
  }

  /**
   * Đăng nhập thật bằng Google qua Google Identity Services OAuth 2.0:
   * Mở popup chính thức của Google để người dùng chọn tài khoản Gmail trên máy của họ.
   */
  async promptSignIn(
    onSuccess: (data: { credential?: string; accessToken?: string }) => void,
    onError?: (msg: string) => void
  ): Promise<void> {
    const ready = await this.waitForGoogleScript();
    if (!ready) {
      onError?.('Không thể tải thư viện Google Identity Services. Vui lòng kiểm tra kết nối mạng và thử lại.');
      return;
    }

    const cid = this.clientId() || DEFAULT_GOOGLE_CLIENT_ID;
    if (!cid) {
      onError?.('Chưa cấu hình Google Client ID.');
      return;
    }

    try {
      if (google.accounts?.oauth2) {
        const client = google.accounts.oauth2.initTokenClient({
          client_id: cid,
          scope: 'email profile openid',
          prompt: 'select_account',
          callback: (tokenRes: any) => {
            if (tokenRes.error) {
              console.error('Google OAuth error:', tokenRes);
              if (tokenRes.error === 'access_denied') {
                onError?.('Bạn đã đóng cửa sổ đăng nhập Google.');
              } else {
                onError?.(`Lỗi đăng nhập Google: ${tokenRes.error_description || tokenRes.error}`);
              }
            } else if (tokenRes.access_token) {
              onSuccess({ accessToken: tokenRes.access_token });
            }
          },
        });
        client.requestAccessToken();
        return;
      }

      await this.initIdListener((credential) => onSuccess({ credential }));
      google.accounts.id.prompt((notification: any) => {
        if (notification.isNotDisplayed()) {
          console.warn('Google prompt not displayed:', notification.getNotDisplayedReason());
        }
      });
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      onError?.(err?.message || 'Không thể khởi động cửa sổ đăng nhập Google.');
    }
  }
}

