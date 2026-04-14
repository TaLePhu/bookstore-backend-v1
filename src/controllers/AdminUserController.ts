import { Request, Response, NextFunction } from 'express';
import { injectable } from 'tsyringe';
import { AdminUserService } from '@services/AdminUserService';
import { AdminUserFilter } from '@repositories/interfaces/IAdminUserRepository';
import { Role } from '@entities/User';
import { sendSuccess } from '@utils/response';

@injectable()
export class AdminUserController {
  constructor(private adminUserService: AdminUserService) {}

  /**
   * GET /admin/users
   * Query params: role?, email?, full_name?, page?, limit?
   */
  listUsers = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { role, email, full_name, page, limit } = req.query;

      const filter: AdminUserFilter = {
        role:     role     ? (role as Role)         : undefined,
        email:    email    ? (email as string)       : undefined,
        fullName: full_name ? (full_name as string)  : undefined,
        page:     page     ? parseInt(page as string, 10)  : 1,
        limit:    limit    ? parseInt(limit as string, 10) : 10,
      };

      const result = await this.adminUserService.listUsers(filter);

      sendSuccess(res, result, 'Lấy danh sách người dùng thành công');
    } catch (error) {
      next(error);
    }
  };

  /**
   * PATCH /admin/users/:id/status
   * Body: { isLocked: boolean }
   */
  updateLockStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id }       = req.params;
      const { isLocked } = req.body;
      const adminId      = (req as any).user.userId as string;

      const user = await this.adminUserService.updateLockStatus(id, isLocked, adminId);

      const action = isLocked ? 'Khoá tài khoản' : 'Mở khoá tài khoản';
      sendSuccess(res, user, `${action} thành công`);
    } catch (error) {
      next(error);
    }
  };

  /**
   * PATCH /admin/users/:id/role
   * Body: { role: Role }
   */
  updateRole = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id }   = req.params;
      const { role } = req.body;
      const adminId  = (req as any).user.userId as string;

      const user = await this.adminUserService.updateRole(id, role, adminId);

      sendSuccess(res, user, `Cấp quyền ${role} thành công`);
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /admin/users/:id/reset-password
   * Body: { newPassword: string }
   */
  resetPassword = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id }          = req.params;
      const { newPassword } = req.body;

      const result = await this.adminUserService.resetPassword(id, newPassword);

      sendSuccess(res, null, result.message);
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /admin/customers/:id/summary
   * Hồ sơ khách hàng + tổng đơn + tổng chi tiêu (Query Builder)
   */
  getCustomerSummary = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;

      const summary = await this.adminUserService.getCustomerSummary(id);

      sendSuccess(res, summary, 'Lấy hồ sơ khách hàng thành công');
    } catch (error) {
      next(error);
    }
  };
}
