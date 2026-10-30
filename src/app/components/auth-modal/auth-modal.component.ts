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

  handleSubmit(e: Event): void {
    e.preventDefault();
    if (!this.email()) return;
    if (this.cart.authTab() === 'login') {
      this.cart.loginWithPassword(this.email(), this.password());
    } else {
      this.cart.signup(this.name() || 'Khách hàng', this.email(), this.password());
    }
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
