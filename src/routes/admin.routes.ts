import { Router } from 'express';
import { container } from 'tsyringe';
import { AdminUserController } from '@controllers/AdminUserController';
import { authMiddleware } from '@middlewares/auth.middleware';
import { roleGuard } from '@middlewares/role.middleware';
import { validateDto } from '@middlewares/validate.middleware';
import { Role } from '@entities/User';
import { UpdateUserStatusDto } from '@dtos/admin/UpdateUserStatusDto';
import { UpdateUserRoleDto } from '@dtos/admin/UpdateUserRoleDto';
import { ResetPasswordDto } from '@dtos/admin/ResetPasswordDto';

const router = Router();
const adminUserController = container.resolve(AdminUserController);

// ─── Bảo vệ toàn bộ route: phải đăng nhập & phải là ADMIN ─────────────────
router.use(authMiddleware);
router.use(roleGuard(Role.ADMIN));

// ─── Quản lý tài khoản ──────────────────────────────────────────────────────

/**
 * GET /admin/users
 * Danh sách tất cả tài khoản, lọc theo role, tìm kiếm theo email / fullName.
 * Query: role?, email?, full_name?, page?, limit?
 */
router.get('/users', adminUserController.listUsers);

/**
 * PATCH /admin/users/:id/status
 * Khoá hoặc mở khoá tài khoản.
 * Body: { isLocked: boolean }
 */
router.patch(
  '/users/:id/status',
  validateDto(UpdateUserStatusDto),
  adminUserController.updateLockStatus,
);

/**
 * PATCH /admin/users/:id/role
 * Cấp / thay đổi role của tài khoản.
 * Body: { role: 'ADMIN' | 'STAFF' | 'CUSTOMER' | 'GUEST' }
 */
router.patch(
  '/users/:id/role',
  validateDto(UpdateUserRoleDto),
  adminUserController.updateRole,
);

/**
 * POST /admin/users/:id/reset-password
 * Đặt lại mật khẩu và gửi email thông báo cho user qua BullMQ.
 * Body: { newPassword: string }
 */
router.post(
  '/users/:id/reset-password',
  validateDto(ResetPasswordDto),
  adminUserController.resetPassword,
);

// ─── Quản lý khách hàng ─────────────────────────────────────────────────────

/**
 * GET /admin/customers/:id/summary
 * Hồ sơ khách hàng: thông tin cá nhân + tổng đơn hàng + tổng chi tiêu.
 */
router.get('/customers/:id/summary', adminUserController.getCustomerSummary);

export default router;
