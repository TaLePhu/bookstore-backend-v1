import { injectable, inject } from 'tsyringe';
import {
  IAdminUserRepository,
  AdminUserFilter,
  CustomerSummary,
  PaginatedUsers,
} from '@repositories/interfaces/IAdminUserRepository';
import { Role, User } from '@entities/User';
import { HashHelper } from '@utils/hash';
import { NotFoundError, ForbiddenError } from '@utils/errors';
import { emailQueue } from '@config/queue';
import { TOKENS } from '@config/container';

// Shape trả về cho danh sách user (không có passwordHash)
export interface AdminUserListItem {
  id: string;
  userName: string;
  fullName: string | null;
  email: string;
  role: Role;
  isVerified: boolean;
  isLocked: boolean;
  createdAt: Date;
}

export interface CreateAdminUserInput {
  userName: string;
  fullName?: string;
  email: string;
  phone?: string;
  password: string;
  role: Role.CUSTOMER | Role.STAFF;
  isVerified?: boolean;
}

@injectable()
export class AdminUserService {
  constructor(
    @inject(TOKENS.ADMIN_USER_REPOSITORY)
    private adminUserRepository: IAdminUserRepository
  ) {}

  // ── GET /admin/users ───────────────────────────────────────────────────────
  async listUsers(filter: AdminUserFilter): Promise<{
    users: AdminUserListItem[];
    total: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const result: PaginatedUsers = await this.adminUserRepository.findAll(filter);

    return {
      ...result,
      users: result.users.map(this.mapToListItem),
    };
  }

  async createUser(input: CreateAdminUserInput): Promise<AdminUserListItem> {
    const passwordHash = await HashHelper.hash(input.password);
    const user = await this.adminUserRepository.createUser({
      userName: input.userName.trim(),
      fullName: input.fullName?.trim() || null,
      email: input.email.trim().toLowerCase(),
      phone: input.phone?.trim() || undefined,
      passwordHash,
      role: input.role,
      isVerified: input.isVerified ?? true,
    });

    return this.mapToListItem(user);
  }

  // ── PATCH /admin/users/:id/status ──────────────────────────────────────────
  async updateLockStatus(
    id: string,
    isLocked: boolean,
    adminId: string,
  ): Promise<AdminUserListItem> {
    // Không cho phép Admin tự khoá chính mình
    if (id === adminId) {
      throw new ForbiddenError('Không thể khoá tài khoản của chính mình');
    }

    const updated = await this.adminUserRepository.updateLockStatus(id, isLocked);
    if (!updated) throw new NotFoundError('Không tìm thấy user');

    return this.mapToListItem(updated);
  }

  // ── PATCH /admin/users/:id/role ────────────────────────────────────────────
  async updateRole(
    id: string,
    role: Role,
    adminId: string,
  ): Promise<AdminUserListItem> {
    // Không cho phép Admin tự hạ cấp chính mình
    if (id === adminId) {
      throw new ForbiddenError('Không thể thay đổi role của chính mình');
    }

    const updated = await this.adminUserRepository.updateRole(id, role);
    if (!updated) throw new NotFoundError('Không tìm thấy user');

    return this.mapToListItem(updated);
  }

  // ── POST /admin/users/:id/reset-password ───────────────────────────────────
  /**
   * Hash mật khẩu mới → lưu vào DB → gửi email thông báo qua BullMQ.
   */
  async resetPassword(id: string, newPassword: string): Promise<{ message: string }> {
    const passwordHash = await HashHelper.hash(newPassword);

    const user = await this.adminUserRepository.resetPassword(id, passwordHash);
    if (!user) throw new NotFoundError('Không tìm thấy user');

    // Gửi email thông báo mật khẩu mới qua BullMQ (emailQueue)
    await emailQueue.add('sendPasswordReset', {
      to: user.email,
      subject: '[BookStore] Mật khẩu của bạn đã được đặt lại',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 480px; margin: auto;">
          <h2 style="color: #e53e3e;">Mật khẩu đã được đặt lại</h2>
          <p>Xin chào <strong>${user.fullName ?? user.userName}</strong>,</p>
          <p>Tài khoản của bạn vừa được Admin đặt lại mật khẩu. Mật khẩu mới của bạn là:</p>
          <p style="font-size: 1.4rem; font-weight: bold; letter-spacing: 2px; color: #2d3748; text-align: center;">
            ${newPassword}
          </p>
          <p style="color: #e53e3e;">Vui lòng đăng nhập và đổi mật khẩu ngay sau khi nhận được email này.</p>
          <hr/>
          <p style="font-size: 12px; color: #999;">BookStore – Hệ thống quản lý sách trực tuyến</p>
        </div>
      `,
    });

    return {
      message: `Đặt lại mật khẩu thành công. Email thông báo đã được gửi đến ${user.email}`,
    };
  }

  // ── GET /admin/customers/:id/summary ───────────────────────────────────────
  async getCustomerSummary(id: string): Promise<CustomerSummary> {
    const summary = await this.adminUserRepository.getCustomerSummary(id);
    if (!summary) throw new NotFoundError('Không tìm thấy khách hàng');

    return summary;
  }

  // ── Private helper ─────────────────────────────────────────────────────────
  async updateCustomerNote(id: string, note?: string): Promise<CustomerSummary> {
    const summary = await this.adminUserRepository.updateCustomerNote(id, note?.trim() || null);
    if (!summary) throw new NotFoundError('KhÃ´ng tÃ¬m tháº¥y khÃ¡ch hÃ ng');

    return summary;
  }

  private mapToListItem(user: User): AdminUserListItem {
    return {
      id:         user.id,
      userName:   user.userName,
      fullName:   user.fullName  ?? null,
      email:      user.email,
      role:       user.role,
      isVerified: user.isVerified,
      isLocked:   user.isLocked,
      createdAt:  user.createdAt,
    };
  }
}
