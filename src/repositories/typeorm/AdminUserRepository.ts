import { Repository } from 'typeorm';
import { User, Role } from '@entities/User';
import { UserAdvance } from '@entities/UserAdvance';
import { Order, OrderStatus } from '@entities/Order';
import { AppDataSource } from '@config/data-source';
import {
  IAdminUserRepository,
  AdminUserWithStats,
  AdminUserFilter,
  PaginatedUsers,
  CustomerSummary,
} from '@repositories/interfaces/IAdminUserRepository';
import { ConflictError, NotFoundError } from '@utils/errors';

export class AdminUserRepository implements IAdminUserRepository {
  private repository: Repository<User>;

  constructor() {
    this.repository = AppDataSource.getRepository(User);
  }

  async createUser(data: {
    userName: string;
    fullName?: string | null;
    email: string;
    passwordHash: string;
    role: Role;
    isVerified?: boolean;
    phone?: string;
  }): Promise<User> {
    const existing = await this.repository.findOne({ where: { email: data.email } });
    if (existing) {
      throw new ConflictError('Email đã được sử dụng');
    }

    const user = this.repository.create({
      userName: data.userName,
      fullName: data.fullName ?? null,
      email: data.email,
      passwordHash: data.passwordHash,
      role: data.role,
      isVerified: data.isVerified ?? true,
      isLocked: false,
    });

    const saved = await this.repository.save(user);

    if (data.phone) {
      const advanceRepo = AppDataSource.getRepository(UserAdvance);
      await advanceRepo.save(advanceRepo.create({ userId: saved.id, phone: data.phone }));
    }

    return saved;
  }

  // ─── GET /admin/users ─────────────────────────────────────────────────────
  async findAll(filter: AdminUserFilter): Promise<PaginatedUsers> {
    const page  = Math.max(1, filter.page  ?? 1);
    const limit = Math.min(500, Math.max(1, filter.limit ?? 10));
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

    if (typeof filter.isVerified === 'boolean') {
      qb.andWhere('user.isVerified = :isVerified', { isVerified: filter.isVerified });
    }

    if (typeof filter.isLocked === 'boolean') {
      qb.andWhere('user.isLocked = :isLocked', { isLocked: filter.isLocked });
    }

    const [users, total] = await qb.getManyAndCount();
    const usersWithStats = await this.attachOrderStats(users);

    return {
      users: usersWithStats,
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
      .leftJoin('user.orders', 'order_entity')
      .addSelect('COUNT(order_entity.id)', 'totalOrders')
      .addSelect(
        `COALESCE(SUM(CASE WHEN order_entity.status = :completedStatus THEN order_entity.totalAmount ELSE 0 END), 0)`,
        'totalSpent'
      )
      .addSelect('MAX(order_entity.createdAt)', 'lastOrderAt')
      .addSelect('user.admin_note', 'adminNote')
      .where('user.id = :id', { id })
      .setParameter('completedStatus', OrderStatus.COMPLETED)
      .groupBy('user.id')
      .addGroupBy('userAdvance.id')
      .getRawAndEntities();

    if (!result.entities.length) return null;

    const user = result.entities[0];
    const raw  = result.raw[0];
    const orderRepo = AppDataSource.getRepository(Order);
    const recentOrders = await orderRepo.find({
      where: { userId: id },
      relations: ['payments'],
      order: { createdAt: 'DESC' },
      take: 8,
    });

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
      adminNote:    raw.adminNote ?? null,
      totalOrders:  parseInt(raw.totalOrders ?? '0', 10),
      totalSpent:   parseFloat(raw.totalSpent ?? '0'),
      lastOrderAt:  raw.lastOrderAt ?? null,
      recentOrders: recentOrders.map((order) => {
        const payment = order.payments?.[0];
        return {
          id: order.id,
          orderCode: order.orderCode ?? null,
          status: order.status,
          totalAmount: Number(order.totalAmount || 0),
          paymentMethod: payment?.method ?? null,
          paymentStatus: payment?.status ?? null,
          createdAt: order.createdAt,
        };
      }),
    };
  }

  async updateCustomerNote(id: string, note: string | null): Promise<CustomerSummary | null> {
    const user = await this.repository.findOne({ where: { id } });
    if (!user) return null;

    await AppDataSource.query('UPDATE "users" SET "admin_note" = $1 WHERE "id" = $2', [note, id]);
    return this.getCustomerSummary(id);
  }

  private async attachOrderStats(users: User[]): Promise<AdminUserWithStats[]> {
    const ids = users.map((user) => user.id);
    if (!ids.length) return users;

    const rows = await AppDataSource.getRepository(Order)
      .createQueryBuilder('order_entity')
      .select('order_entity.userId', 'userId')
      .addSelect('COUNT(order_entity.id)', 'totalOrders')
      .addSelect(
        `COALESCE(SUM(CASE WHEN order_entity.status = :completedStatus THEN order_entity.totalAmount ELSE 0 END), 0)`,
        'totalSpent'
      )
      .addSelect('MAX(order_entity.createdAt)', 'lastOrderAt')
      .where('order_entity.userId IN (:...ids)', { ids })
      .setParameter('completedStatus', OrderStatus.COMPLETED)
      .groupBy('order_entity.userId')
      .getRawMany();

    const statsByUserId = new Map(
      rows.map((row) => [
        row.userId,
        {
          totalOrders: parseInt(row.totalOrders ?? '0', 10),
          totalSpent: parseFloat(row.totalSpent ?? '0'),
          lastOrderAt: row.lastOrderAt ?? null,
        },
      ])
    );

    return users.map((user) =>
      Object.assign(user, statsByUserId.get(user.id) || {
        totalOrders: 0,
        totalSpent: 0,
        lastOrderAt: null,
      })
    );
  }
}
