import { Repository } from 'typeorm';
import { User, Role } from '@entities/User';
import { AppDataSource } from '@config/data-source';
import {
  IAdminUserRepository,
  AdminUserFilter,
  PaginatedUsers,
  CustomerSummary,
} from '@repositories/interfaces/IAdminUserRepository';
import { NotFoundError } from '@utils/errors';

export class AdminUserRepository implements IAdminUserRepository {
  private repository: Repository<User>;

  constructor() {
    this.repository = AppDataSource.getRepository(User);
  }

  // ─── GET /admin/users ─────────────────────────────────────────────────────
  async findAll(filter: AdminUserFilter): Promise<PaginatedUsers> {
    const page  = Math.max(1, filter.page  ?? 1);
    const limit = Math.min(100, Math.max(1, filter.limit ?? 10));
    const skip  = (page - 1) * limit;

    const qb = this.repository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.userAdvance', 'userAdvance')
      .orderBy('user.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (filter.role) {
      qb.andWhere('user.role = :role', { role: filter.role });
    }

    if (filter.email) {
      qb.andWhere('LOWER(user.email) LIKE LOWER(:email)', {
        email: `%${filter.email}%`,
      });
    }

    if (filter.fullName) {
      qb.andWhere('LOWER(user.fullName) LIKE LOWER(:fullName)', {
        fullName: `%${filter.fullName}%`,
      });
    }

    const [users, total] = await qb.getManyAndCount();

    return {
      users,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  // ─── PATCH /admin/users/:id/status ────────────────────────────────────────
  async updateLockStatus(id: string, isLocked: boolean): Promise<User | null> {
    const user = await this.repository.findOne({ where: { id } });
    if (!user) throw new NotFoundError(`Không tìm thấy user id=${id}`);

    user.isLocked = isLocked;
    return this.repository.save(user);
  }

  // ─── PATCH /admin/users/:id/role ──────────────────────────────────────────
  async updateRole(id: string, role: Role): Promise<User | null> {
    const user = await this.repository.findOne({ where: { id } });
    if (!user) throw new NotFoundError(`Không tìm thấy user id=${id}`);

    user.role = role;
    return this.repository.save(user);
  }

  // ─── POST /admin/users/:id/reset-password ─────────────────────────────────
  async resetPassword(id: string, passwordHash: string): Promise<User | null> {
    const user = await this.repository.findOne({ where: { id } });
    if (!user) throw new NotFoundError(`Không tìm thấy user id=${id}`);

    user.passwordHash = passwordHash;
    return this.repository.save(user);
  }

  // ─── GET /admin/customers/:id/summary ─────────────────────────────────────
  /**
   * Dùng Query Builder để tính COUNT và SUM trong 1 query duy nhất:
   *  - LEFT JOIN userAdvance để lấy thông tin liên hệ
   *  - LEFT JOIN orders để tính tổng đơn hàng và tổng chi tiêu
   */
  async getCustomerSummary(id: string): Promise<CustomerSummary | null> {
    const result = await this.repository
      .createQueryBuilder('user')
      .leftJoinAndSelect('user.userAdvance', 'userAdvance')
      .leftJoin('user.orders', 'order')
      .addSelect('COUNT(order.id)', 'totalOrders')
      .addSelect('COALESCE(SUM(order.totalAmount), 0)', 'totalSpent')
      .where('user.id = :id', { id })
      .groupBy('user.id')
      .addGroupBy('userAdvance.id')
      .getRawAndEntities();

    if (!result.entities.length) return null;

    const user = result.entities[0];
    const raw  = result.raw[0];

    return {
      id:           user.id,
      userName:     user.userName,
      fullName:     user.fullName   ?? null,
      email:        user.email,
      role:         user.role,
      isVerified:   user.isVerified,
      isLocked:     user.isLocked,
      phone:        user.userAdvance?.phone   ?? null,
      avatar:       user.userAdvance?.avatar  ?? null,
      createdAt:    user.createdAt,
      totalOrders:  parseInt(raw.totalOrders ?? '0', 10),
      totalSpent:   parseFloat(raw.totalSpent ?? '0'),
    };
  }
}
