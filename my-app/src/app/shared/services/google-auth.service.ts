import { Injectable, inject, signal } from '@angular/core';
import { ApiService } from './api.service';

declare const google: any;

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
      return localStorage.getItem('GOOGLE_CLIENT_ID') || '';
    } catch {
      return '';
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
   * Mở popup OAuth2 / Token client hoặc One-tap prompt
   */
  async promptSignIn(
    onSuccess: (data: { credential?: string; accessToken?: string }) => void,
    onError?: (msg: string) => void
  ): Promise<void> {
    const ready = await this.waitForGoogleScript();
    if (!ready) {
      onError?.('Không thể tải thư viện Google Identity Services. Vui lòng thử lại sau.');
      return;
    }

    let cid = this.clientId();
    if (!cid) {
      // Nếu chưa có Client ID, cho phép nhập hoặc test ngay bằng tài khoản Demo
      const input = prompt(
        'TÍCH HỢP GOOGLE SIGN-IN:\n\n' +
        '1. Nếu bạn đã có Google Client ID (dạng xxxx.apps.googleusercontent.com), hãy dán vào đây.\n\n' +
        '2. Nếu CHƯA CÓ, bạn bấm OK (để trống) để ĐĂNG NHẬP / ĐĂNG KÝ THỬ NGHIỆM ngay bằng tài khoản Google Demo!'
      );
      if (input !== null && input.trim()) {
        this.setClientId(input.trim());
        cid = input.trim();
      } else if (input !== null) {
        // Người dùng chọn chế độ Demo
        onSuccess({ credential: 'demo_google_token' });
        return;
      } else {
        onError?.('Đã hủy đăng nhập Google.');
        return;
      }
    }

    try {
      // Ưu tiên Token Client OAuth2 (mở popup chọn tài khoản Google chuẩn)
      if (google.accounts?.oauth2) {
        const client = google.accounts.oauth2.initTokenClient({
          client_id: cid,
          scope: 'email profile openid',
          callback: (tokenRes: any) => {
            if (tokenRes.error) {
              console.error('Google OAuth error:', tokenRes);
              onError?.(tokenRes.error_description || tokenRes.error || 'Đăng nhập Google bị hủy hoặc thất bại.');
            } else if (tokenRes.access_token) {
              onSuccess({ accessToken: tokenRes.access_token });
            }
          },
        });
        client.requestAccessToken();
        return;
      }

      // Fallback: Google One Tap / Credential prompt
      await this.initIdListener((credential) => onSuccess({ credential }));
      google.accounts.id.prompt((notification: any) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          console.log('Google prompt not displayed/skipped:', notification.getNotDisplayedReason());
        }
      });
    } catch (err: any) {
      console.error('Google sign-in error:', err);
      onError?.(err?.message || 'Không thể khởi động đăng nhập Google.');
    }
  }
}

