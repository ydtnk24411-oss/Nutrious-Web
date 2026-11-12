import { Component, signal, inject, OnDestroy, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CartService, AuthTab } from '../../shared/services/cart.service';
import { GoogleAuthService } from '../../shared/services/google-auth.service';

@Component({
  selector: 'app-auth-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './auth-modal.component.html',
  styleUrl: './auth-modal.component.css',
})
export class AuthModalComponent implements OnDestroy {
  protected cart = inject(CartService);
  protected googleAuth = inject(GoogleAuthService);

  constructor() {
    effect(() => {
      const open = this.cart.authModalOpen();
      const prefill = this.cart.authPrefill();
      if (open && prefill) {
        if (prefill.name?.trim()) {
          this.name.set(prefill.name.trim());
        }
        if (prefill.phone?.trim()) {
          this.phone.set(prefill.phone.trim());
        }
      }
    });
  }

  // Form input signals
  protected name = signal('');
  protected phone = signal('');
  protected loginIdentifier = signal('');
  protected password = signal('');
  protected confirmPassword = signal('');

  // Forgot password flow signals
  protected forgotPhone = signal('');
  protected forgotStep = signal<1 | 2 | 3>(1); // 1: Phone, 2: OTP, 3: New Password
  protected resetToken = signal('');
  protected newPassword = signal('');
  protected confirmNewPassword = signal('');

  // OTP flow state
  protected otpStep = signal(false); // false: nhập thông tin, true: nhập mã OTP
  protected otpDigits = signal<string[]>(['', '', '', '', '', '']);
  protected otpLoading = signal(false);
  protected countdown = signal(60);
  protected canResend = signal(false);
  private countdownInterval: any = null;
  protected verifiedPhone = signal('');
  protected demoOtp = signal<string>('123456');

  // UI state
  protected loading = signal(false);
  protected googleLoading = signal(false);
  protected errorMessage = signal('');
  protected infoMessage = signal('');
  protected showLoginPassword = signal(false);
  protected showRegPassword = signal(false);
  protected showRegConfirmPassword = signal(false);
  protected showForgotNewPassword = signal(false);
  protected showForgotConfirmPassword = signal(false);

  ngOnDestroy(): void {
    this.clearCountdown();
  }

  // Chuẩn hóa và kiểm tra số điện thoại Việt Nam
  isValidPhone(phone: string): boolean {
    const cleaned = phone.replace(/[\s\-.()]/g, '');
    const normalized = cleaned.startsWith('+84')
      ? '0' + cleaned.slice(3)
      : cleaned.startsWith('84') && cleaned.length >= 11
      ? '0' + cleaned.slice(2)
      : cleaned;
    return /^(0)(3|5|7|8|9)[0-9]{8}$/.test(normalized);
  }

  // Chuyển tab Đăng nhập / Đăng ký / Quên mật khẩu
  setTab(tab: AuthTab): void {
    this.errorMessage.set('');
    this.infoMessage.set('');
    this.password.set('');
    this.confirmPassword.set('');
    this.newPassword.set('');
    this.confirmNewPassword.set('');
    this.showLoginPassword.set(false);
    this.showRegPassword.set(false);
    this.showRegConfirmPassword.set(false);
    this.showForgotNewPassword.set(false);
    this.showForgotConfirmPassword.set(false);
    this.otpStep.set(false);
    this.forgotStep.set(1);
    this.otpDigits.set(['', '', '', '', '', '']);
    this.clearCountdown();
    this.cart.setAuthTab(tab);
  }

  // Đóng modal
  close(): void {
    this.clearCountdown();
    this.otpStep.set(false);
    this.forgotStep.set(1);
    this.showLoginPassword.set(false);
    this.showRegPassword.set(false);
    this.showRegConfirmPassword.set(false);
    this.showForgotNewPassword.set(false);
    this.showForgotConfirmPassword.set(false);
    this.errorMessage.set('');
    this.infoMessage.set('');
    this.cart.closeAuthModal();
  }

  // =========================================================================
  // LUỒNG ĐĂNG NHẬP
  // =========================================================================
  handleLogin(e: Event): void {
    e.preventDefault();
    this.errorMessage.set('');
    this.infoMessage.set('');

    const identifier = this.loginIdentifier().trim();
    const password = this.password();

    if (!identifier) {
      this.errorMessage.set('Vui lòng nhập số điện thoại hoặc email.');
      return;
    }
    if (!password) {
      this.errorMessage.set('Vui lòng nhập mật khẩu.');
      return;
    }

    this.loading.set(true);
    this.cart.login(
      identifier,
      password,
      () => {
        this.loading.set(false);
        this.resetForm();
      },
      (errMsg) => {
        this.loading.set(false);
        this.errorMessage.set(errMsg);
      }
    );
  }

  // Đăng nhập bằng Google (Chỉ cho tài khoản đã liên kết từ trước)
  handleGoogleLogin(): void {
    this.errorMessage.set('');
    this.infoMessage.set('');
    this.googleLoading.set(true);

    this.googleAuth.promptSignIn(
      (data) => {
        this.cart.loginWithGoogle(
          data,
          () => {
            this.googleLoading.set(false);
            this.resetForm();
          },
          (errMsg) => {
            this.googleLoading.set(false);
            // Hiển thị thông báo chính xác theo yêu cầu
            this.errorMessage.set(errMsg);
          }
        );
      },
      (errorMsg) => {
        this.googleLoading.set(false);
        this.errorMessage.set(errorMsg);
      }
    );
  }

  // =========================================================================
  // LUỒNG ĐĂNG KÝ BẰNG SỐ ĐIỆN THOẠI (Phone-first Registration)
  // =========================================================================

  // Bước 1: Gửi yêu cầu đăng ký & nhận mã OTP
  handleRequestRegisterOtp(e: Event): void {
    e.preventDefault();
    this.errorMessage.set('');
    this.infoMessage.set('');

    const name = this.name().trim();
    const phone = this.phone().trim();
    const password = this.password();
    const confirm = this.confirmPassword();

    if (!name) {
      this.errorMessage.set('Vui lòng nhập họ và tên.');
      return;
    }
    if (!phone) {
      this.errorMessage.set('Vui lòng nhập số điện thoại.');
      return;
    }
    if (!this.isValidPhone(phone)) {
      this.errorMessage.set('Số điện thoại không đúng định dạng di động Việt Nam (10 số, bắt đầu bằng 03, 05, 07, 08, 09).');
      return;
    }
    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(password)) {
      this.errorMessage.set('Mật khẩu phải có tối thiểu 8 ký tự, bao gồm ít nhất 1 chữ hoa, 1 chữ thường và 1 chữ số.');
      return;
    }
    if (password !== confirm) {
      this.errorMessage.set('Mật khẩu xác nhận không khớp.');
      return;
    }

    this.loading.set(true);
    this.cart.requestRegisterOtp(
      name,
      phone,
      password,
      confirm,
      (res) => {
        this.loading.set(false);
        this.verifiedPhone.set(res.phone || phone);
        if (res.demoOtp) {
          this.demoOtp.set(res.demoOtp);
        }
        this.otpStep.set(true);
        this.otpDigits.set(['', '', '', '', '', '']);
        this.infoMessage.set(`Mã xác minh gồm 6 số đã được gửi đến số điện thoại ${res.phone || phone}.`);
        this.startCountdown();
        setTimeout(() => this.focusOtpInput(0), 100);
      },
      (errMsg) => {
        this.loading.set(false);
        this.errorMessage.set(errMsg);
      }
    );
  }

  // Bước 2 & 3: Xác minh OTP & Hoàn tất tạo tài khoản
  handleVerifyOtp(e?: Event): void {
    if (e) e.preventDefault();
    this.errorMessage.set('');
    this.infoMessage.set('');

    const otp = this.otpDigits().join('');
    if (otp.length !== 6) {
      this.errorMessage.set('Vui lòng nhập đủ 6 chữ số mã OTP.');
      return;
    }

    this.otpLoading.set(true);
    this.cart.verifyRegisterOtp(
      this.verifiedPhone(),
      otp,
      () => {
        this.otpLoading.set(false);
        this.clearCountdown();
        this.resetForm();
      },
      (errMsg) => {
        this.otpLoading.set(false);
        this.errorMessage.set(errMsg);
      }
    );
  }

  // Gửi lại mã OTP
  handleResendOtp(): void {
    if (!this.canResend()) return;
    this.errorMessage.set('');
    this.infoMessage.set('');

    this.cart.resendRegisterOtp(
      this.verifiedPhone(),
      (res) => {
        if (res.demoOtp) {
          this.demoOtp.set(res.demoOtp);
        }
        this.infoMessage.set(`Đã gửi lại mã OTP mới đến số điện thoại ${this.verifiedPhone()}.`);
        this.startCountdown();
        this.otpDigits.set(['', '', '', '', '', '']);
        setTimeout(() => this.focusOtpInput(0), 100);
      },
      (errMsg) => {
        this.errorMessage.set(errMsg);
      }
    );
  }

  // Quay lại form nhập thông tin từ màn hình OTP
  backToRegisterForm(): void {
    this.otpStep.set(false);
    this.clearCountdown();
    this.errorMessage.set('');
    this.infoMessage.set('');
  }

  // =========================================================================
  // XỬ LÝ 6 Ô NHẬP OTP (Auto-focus, Backspace, Paste)
  // =========================================================================

  onOtpInput(index: number, event: Event): void {
    const input = event.target as HTMLInputElement;
    const val = input.value.replace(/[^0-9]/g, '');

    const current = [...this.otpDigits()];
    if (val) {
      current[index] = val.slice(-1);
      this.otpDigits.set(current);
      if (index < 5) {
        this.focusOtpInput(index + 1);
      } else {
        // Tự động kiểm tra khi nhập đủ 6 số
        if (current.join('').length === 6) {
          if (this.cart.authTab() === 'forgot') {
            this.handleVerifyForgotOtp();
          } else {
            this.handleVerifyOtp();
          }
        }
      }
    } else {
      current[index] = '';
      this.otpDigits.set(current);
    }
  }

  onOtpKeyDown(index: number, event: KeyboardEvent): void {
    if (event.key === 'Backspace') {
      const current = [...this.otpDigits()];
      if (!current[index] && index > 0) {
        current[index - 1] = '';
        this.otpDigits.set(current);
        this.focusOtpInput(index - 1);
        event.preventDefault();
      } else {
        current[index] = '';
        this.otpDigits.set(current);
      }
    } else if (event.key === 'ArrowLeft' && index > 0) {
      this.focusOtpInput(index - 1);
    } else if (event.key === 'ArrowRight' && index < 5) {
      this.focusOtpInput(index + 1);
    }
  }

  onOtpPaste(event: ClipboardEvent): void {
    event.preventDefault();
    const pasted = event.clipboardData?.getData('text') || '';
    const digits = pasted.replace(/[^0-9]/g, '').slice(0, 6).split('');
    if (digits.length > 0) {
      const current = ['', '', '', '', '', ''];
      for (let i = 0; i < digits.length; i++) {
        current[i] = digits[i];
      }
      this.otpDigits.set(current);
      if (digits.length === 6) {
        this.focusOtpInput(5);
        if (this.cart.authTab() === 'forgot') {
          this.handleVerifyForgotOtp();
        } else {
          this.handleVerifyOtp();
        }
      } else {
        this.focusOtpInput(digits.length);
      }
    }
  }

  private focusOtpInput(index: number): void {
    const el = document.getElementById(`otp-input-${index}`) as HTMLInputElement;
    if (el) {
      el.focus();
      el.select();
    }
  }

  // Đếm ngược 60 giây gửi lại mã OTP
  private startCountdown(): void {
    this.clearCountdown();
    this.countdown.set(60);
    this.canResend.set(false);
    this.countdownInterval = setInterval(() => {
      const current = this.countdown();
      if (current <= 1) {
        this.countdown.set(0);
        this.canResend.set(true);
        this.clearCountdown();
      } else {
        this.countdown.set(current - 1);
      }
    }, 1000);
  }

  private clearCountdown(): void {
    if (this.countdownInterval) {
      clearInterval(this.countdownInterval);
      this.countdownInterval = null;
    }
  }

  private resetForm(): void {
    this.name.set('');
    this.phone.set('');
    this.loginIdentifier.set('');
    this.password.set('');
    this.confirmPassword.set('');
    this.forgotPhone.set('');
    this.newPassword.set('');
    this.confirmNewPassword.set('');
    this.resetToken.set('');
    this.otpStep.set(false);
    this.forgotStep.set(1);
    this.otpDigits.set(['', '', '', '', '', '']);
    this.errorMessage.set('');
    this.infoMessage.set('');
    this.clearCountdown();
  }

  handleForgotPassword(): void {
    if (this.cart.currentUser()?.phone) {
      this.forgotPhone.set(this.cart.currentUser()!.phone || '');
    } else if (this.loginIdentifier() && this.isValidPhone(this.loginIdentifier())) {
      this.forgotPhone.set(this.loginIdentifier());
    }
    this.setTab('forgot');
  }

  // =========================================================================
  // LUỒNG QUÊN MẬT KHẨU (Forgot Password - BR-ACC-10 Mock OTP 123456)
  // =========================================================================

  handleRequestForgotOtp(e: Event): void {
    e.preventDefault();
    this.errorMessage.set('');
    this.infoMessage.set('');

    const phone = this.forgotPhone().trim();
    if (!phone) {
      this.errorMessage.set('Vui lòng nhập số điện thoại đã đăng ký.');
      return;
    }
    if (!this.isValidPhone(phone)) {
      this.errorMessage.set('Số điện thoại không đúng định dạng di động Việt Nam (10 số, bắt đầu bằng 03, 05, 07, 08, 09).');
      return;
    }

    this.loading.set(true);
    this.cart.requestForgotPasswordOtp(
      phone,
      (res) => {
        this.loading.set(false);
        this.verifiedPhone.set(res.phone || phone);
        if (res.demoOtp) {
          this.demoOtp.set(res.demoOtp);
        }
        this.forgotStep.set(2);
        this.otpDigits.set(['', '', '', '', '', '']);
        this.infoMessage.set(`Mã xác thực OTP đã được gửi đến số điện thoại ${res.phone || phone}.`);
        this.startCountdown();
        setTimeout(() => this.focusOtpInput(0), 100);
      },
      (errMsg) => {
        this.loading.set(false);
        this.errorMessage.set(errMsg);
      }
    );
  }

  handleVerifyForgotOtp(e?: Event): void {
    if (e) e.preventDefault();
    this.errorMessage.set('');
    this.infoMessage.set('');

    const otp = this.otpDigits().join('');
    if (otp.length !== 6) {
      this.errorMessage.set('Vui lòng nhập đủ 6 chữ số mã OTP.');
      return;
    }

    this.otpLoading.set(true);
    this.cart.verifyForgotPasswordOtp(
      this.verifiedPhone(),
      otp,
      (res) => {
        this.otpLoading.set(false);
        this.resetToken.set(res.resetToken);
        this.clearCountdown();
        this.forgotStep.set(3);
        this.infoMessage.set(res.message || 'Xác thực OTP thành công! Vui lòng thiết lập mật khẩu mới.');
      },
      (errMsg) => {
        this.otpLoading.set(false);
        this.errorMessage.set(errMsg);
      }
    );
  }

  handleResendForgotOtp(): void {
    if (!this.canResend()) return;
    this.errorMessage.set('');
    this.infoMessage.set('');

    this.cart.resendForgotPasswordOtp(
      this.verifiedPhone(),
      (res) => {
        if (res.demoOtp) {
          this.demoOtp.set(res.demoOtp);
        }
        this.infoMessage.set(`Đã gửi lại mã OTP mới đến số điện thoại ${this.verifiedPhone()}.`);
        this.startCountdown();
        this.otpDigits.set(['', '', '', '', '', '']);
        setTimeout(() => this.focusOtpInput(0), 100);
      },
      (errMsg) => {
        this.errorMessage.set(errMsg);
      }
    );
  }

  handleResetPassword(e: Event): void {
    e.preventDefault();
    this.errorMessage.set('');
    this.infoMessage.set('');

    const newPwd = this.newPassword();
    const confirmPwd = this.confirmNewPassword();

    const passwordRegex = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).{8,}$/;
    if (!passwordRegex.test(newPwd)) {
      this.errorMessage.set('Mật khẩu mới phải có tối thiểu 8 ký tự, bao gồm ít nhất 1 chữ hoa, 1 chữ thường và 1 chữ số.');
      return;
    }

    if (newPwd !== confirmPwd) {
      this.errorMessage.set('Mật khẩu xác nhận không khớp.');
      return;
    }

    this.loading.set(true);
    this.cart.resetPasswordWithToken(
      this.verifiedPhone(),
      this.resetToken(),
      newPwd,
      confirmPwd,
      (msg) => {
        this.loading.set(false);
        const successPhone = this.verifiedPhone();
        this.resetForm();
        this.loginIdentifier.set(successPhone);
        this.setTab('login');
        this.infoMessage.set(msg || 'Đặt lại mật khẩu thành công! Bạn có thể đăng nhập bằng mật khẩu mới.');
      },
      (errMsg) => {
        this.loading.set(false);
        this.errorMessage.set(errMsg);
      }
    );
  }
}
