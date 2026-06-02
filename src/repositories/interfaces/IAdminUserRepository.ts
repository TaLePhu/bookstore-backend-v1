import { Role, User } from '@entities/User';

export interface AdminUserFilter {
  role?: Role;
  email?: string;
  fullName?: string;
  isVerified?: boolean;
  isLocked?: boolean;
  page?: number;
  limit?: number;
}

export interface PaginatedUsers {
  users: User[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export interface CustomerSummary {
  id: string;
  userName: string;
  fullName: string | null;
  email: string;
  role: Role;
  isVerified: boolean;
  isLocked: boolean;
  phone: string | null;
  avatar: string | null;
  createdAt: Date;
  adminNote: string | null;
  totalOrders: number;
  totalSpent: number;
  lastOrderAt: Date | null;
  recentOrders: Array<{
    id: string;
    orderCode: string | null;
    status: string;
    totalAmount: number;
    paymentMethod: string | null;
    paymentStatus: string | null;
    createdAt: Date;
  }>;
}

export interface IAdminUserRepository {
  createUser(data: {
    userName: string;
    fullName?: string | null;
    email: string;
    passwordHash: string;
    role: Role;
    isVerified?: boolean;
    phone?: string;
  }): Promise<User>;
  /** Lấy danh sách user, hỗ trợ lọc role và tìm kiếm email/fullName  */
  findAll(filter: AdminUserFilter): Promise<PaginatedUsers>;

  /** Khoá hoặc mở khoá tài khoản (cập nhật field isLocked) */
  updateLockStatus(id: string, isLocked: boolean): Promise<User | null>;

  /** Cấp / thay đổi role */
  updateRole(id: string, role: Role): Promise<User | null>;

  /** Reset mật khẩu — nhận vào passwordHash đã được hash sẵn */
  resetPassword(id: string, passwordHash: string): Promise<User | null>;

  /** Hồ sơ khách hàng kèm COUNT đơn hàng và SUM tổng chi tiêu */
  getCustomerSummary(id: string): Promise<CustomerSummary | null>;
  updateCustomerNote(id: string, note: string | null): Promise<CustomerSummary | null>;
}
