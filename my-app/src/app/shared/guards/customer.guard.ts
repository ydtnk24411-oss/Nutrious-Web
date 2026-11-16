import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { CartService } from '../services/cart.service';

export const customerGuard: CanActivateFn = () => {
  const cart   = inject(CartService);
  const router = inject(Router);

  // Chiến lược Deferred Login: Chỉ khách hàng đã đăng nhập mới được vào trang Checkout đặt hàng
  if (cart.currentUser()) {
    return true;
  }

  // Mở modal đăng nhập và chuyển hướng về giỏ hàng nếu chưa đăng nhập
  cart.openAuthModal('login');
  router.navigate(['/cart'], {
    queryParams: { redirect: 'checkout', message: 'Vui lòng đăng nhập tài khoản khách hàng để tiến hành thanh toán và đặt hàng.' }
  });
  return false;
};
