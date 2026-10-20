import { HttpInterceptorFn, HttpErrorResponse } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const router = inject(Router);

  return next(req).pipe(
    catchError((err: HttpErrorResponse) => {
      // Nếu đang ở trang admin và nhận 401 → token hết hạn → auto logout
      if (err.status === 401 && router.url.startsWith('/admin')) {
        localStorage.removeItem('xanhla_admin_token');
        localStorage.removeItem('xanhla_admin_user');
        router.navigate(['/admin/login'], {
          queryParams: { expired: '1' },
        });
      }
      return throwError(() => err);
    })
  );
};
