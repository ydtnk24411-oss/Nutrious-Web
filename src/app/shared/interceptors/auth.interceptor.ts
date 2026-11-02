import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';
import { CartService } from '../services/cart.service';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      // Chỉ xử lý khi request có gửi token (tức là phiên đăng nhập hết hạn / không hợp lệ).
      // Đăng nhập sai mật khẩu (/auth/login) cũng trả 401 nhưng không có token → bỏ qua.
      const hadToken = req.headers.has('Authorization');
      if (err.status === 401 && hadToken) {
        if (router.url.startsWith('/admin')) {
          // Admin app (localhost:4201)
          localStorage.removeItem('xanhla_admin_token');
          localStorage.removeItem('xanhla_admin_user');
          router.navigate(['/admin/login'], { queryParams: { expired: '1' } });
        } else {
          // Storefront (localhost:4200): xóa phiên, yêu cầu đăng nhập lại
          inject(CartService).expireSession();
        }
      }
      return throwError(() => err);
    })
  );
};
