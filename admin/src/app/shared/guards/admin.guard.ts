import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AdminAuthService } from '../services/admin-auth.service';

export const adminGuard: CanActivateFn = () => {
  const auth   = inject(AdminAuthService);
  const router = inject(Router);

  if (!auth.isLoggedIn()) {
    router.navigate(['/admin/login']);
    return false;
  }

  // Cho phép tất cả nhân viên thuộc 4 nhóm vai trò RBAC (Manager, Sales, Warehouse, Marketing)
  const role = (auth.user()?.role || '').toLowerCase();
  const allowedRoles = ['admin', 'manager', 'sales', 'warehouse', 'marketing', 'support', 'content'];
  const isAuthorized = allowedRoles.includes(role);

  if (!isAuthorized) {
    router.navigate(['/admin/login-failed'], {
      queryParams: { reason: 'unauthorized_role', message: 'Tài khoản không có quyền nhân viên hợp lệ để truy cập hệ thống quản trị.' }
    });
    return false;
  }

  return true;
};

// Route Guard tham số hóa roleGuard(['Sales', 'Manager']) theo yêu cầu nghiệp vụ 14
export const roleGuard = (allowedRoles: string[]): CanActivateFn => {
  return () => {
    const auth = inject(AdminAuthService);
    const router = inject(Router);

    if (!auth.isLoggedIn()) {
      router.navigate(['/admin/login']);
      return false;
    }

    const role = (auth.user()?.role || '').toLowerCase();
    const normalized = allowedRoles.map(r => r.toLowerCase());

    if (role === 'admin' || role === 'manager' || normalized.includes(role)) {
      return true;
    }

    router.navigate(['/admin/orders'], {
      queryParams: { error: 'permission_denied', message: 'Chỉ Quản lý (Manager) mới có quyền truy cập chức năng này.' }
    });
    return false;
  };
};
