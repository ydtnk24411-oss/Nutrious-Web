import { Component, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { CartService, AuthTab } from '../../shared/services/cart.service';

@Component({
  selector: 'app-auth-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './auth-modal.component.html',
  styleUrl: './auth-modal.component.css',
})
export class AuthModalComponent {
  protected cart = inject(CartService);

  protected name = signal('');
  protected email = signal('');
  protected password = signal('');
  protected confirmPassword = signal('');

 handleSubmit(e: Event): void {
  e.preventDefault();

  const email = this.email().trim();
  const password = this.password();

  if (!email || !password) return;

  if (this.cart.authTab() === 'login') {
    this.cart.loginWithPassword(email, password);
    return;
  }

  if (password !== this.confirmPassword()) {
    alert('Mật khẩu xác nhận không khớp!');
    return;
  }

  this.cart.signup(
    this.name() || 'Khách hàng',
    email,
    password,
    () => {
      this.password.set('');
      this.confirmPassword.set('');
    }
  );
}

  handleGoogleLogin(): void {
    this.cart.login('member@gmail.com', 'Nguyễn Văn A');
  }

  handleForgotPassword(): void {
    alert('Tính năng quên mật khẩu đang được phát triển. Vui lòng liên hệ hỗ trợ để đặt lại mật khẩu.');
  }

  setTab(tab: AuthTab): void {
    this.cart.setAuthTab(tab);
  }
}
