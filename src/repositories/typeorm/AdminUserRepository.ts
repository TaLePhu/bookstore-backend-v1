import { Repository } from 'typeorm';
import { User, Role } from '@entities/User';
import { UserAdvance } from '@entities/UserAdvance';
import { Order, OrderStatus } from '@entities/Order';
import { OrderStatusLog } from '@entities/OrderStatusLog';
import { AppDataSource } from '@config/data-source';
import {
  IAdminUserRepository,
  AdminUserWithStats,
  AdminUserFilter,
  PaginatedUsers,
  CustomerSummary,
  StaffSummary,
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
      .where('user.id = :id', { id })
      .setParameter('completedStatus', OrderStatus.COMPLETED)
      .groupBy('user.id')
      .addGroupBy('userAdvance.id')
      .getRawAndEntities();

    if (!result.entities.length) return null;

    const user = result.entities[0];
    const raw  = result.raw[0];
    const adminNote = await this.getAdminNoteSafely(id);
    const orderRepo = AppDataSource.getRepository(Order);
    const recentOrders = await orderRepo.find({
      where: { userId: id },
      relations: ['payments', 'items', 'items.book'],
      order: { createdAt: 'DESC' },
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
      adminNote,
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
          items: (order.items || []).map((item) => ({
            id: item.id,
            quantity: Number(item.quantity || 0),
            price: Number(item.price || 0),
            subTotal: Number(item.subTotal || 0),
            book: item.book
              ? {
                  id: item.book.id,
                  title: item.book.title,
                  author: item.book.author,
                  isbn: item.book.isbn,
                }
              : null,
          })),
        };
      }),
    };
  }

  async updateCustomerNote(id: string, note: string | null): Promise<CustomerSummary | null> {
    const user = await this.repository.findOne({ where: { id } });
    if (!user) return null;

    await this.ensureAdminNoteColumn();
    await AppDataSource.query('UPDATE "users" SET "admin_note" = $1 WHERE "id" = $2', [note, id]);
    return this.getCustomerSummary(id);
  }

  private async ensureAdminNoteColumn(): Promise<void> {
    await AppDataSource.query('ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "admin_note" text');
  }

  private async getAdminNoteSafely(id: string): Promise<string | null> {
    try {
      const rows = await AppDataSource.query('SELECT "admin_note" FROM "users" WHERE "id" = $1 LIMIT 1', [id]);
      return rows?.[0]?.admin_note ?? null;
    } catch {
      return null;
    }
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

  async getStaffSummary(id: string): Promise<StaffSummary | null> {
    const user = await this.repository.findOne({ where: { id } });
    if (!user || ![Role.STAFF, Role.ADMIN].includes(user.role)) return null;

    const logRepo = AppDataSource.getRepository(OrderStatusLog);
    const allLogs = await logRepo.find({
      where: { changedBy: id },
      relations: ['order'],
      order: { createdAt: 'DESC' },
    });
    const recentLogs = allLogs.slice(0, 100);

    const confirmed = allLogs.filter((log) => log.toStatus === OrderStatus.PROCESSING).length;
    const packed = allLogs.filter((log) => log.toStatus === OrderStatus.SHIPPED).length;
    const completed = allLogs.filter((log) => log.toStatus === OrderStatus.COMPLETED).length;
    const handledOrderIds = new Set(allLogs.map((log) => log.orderId));
    const recentOrdersById = new Map<string, Order>();

    allLogs.forEach((log) => {
      if (log.order && !recentOrdersById.has(log.orderId)) {
        recentOrdersById.set(log.orderId, log.order);
      }
    });

    const dailyStatsMap = new Map<string, { date: string; confirmed: number; packed: number; completed: number }>();
    allLogs.forEach((log) => {
      const date = log.createdAt.toISOString().slice(0, 10);
      const stats = dailyStatsMap.get(date) || { date, confirmed: 0, packed: 0, completed: 0 };
      if (log.toStatus === OrderStatus.PROCESSING) stats.confirmed += 1;
      if (log.toStatus === OrderStatus.SHIPPED) stats.packed += 1;
      if (log.toStatus === OrderStatus.COMPLETED) stats.completed += 1;
      dailyStatsMap.set(date, stats);
    });

    return {
      id: user.id,
      userName: user.userName,
      fullName: user.fullName ?? null,
      email: user.email,
      role: user.role,
      isVerified: user.isVerified,
      isLocked: user.isLocked,
      createdAt: user.createdAt,
      totals: {
        confirmed,
        packed,
        completed,
        totalActions: allLogs.length,
        handledOrders: handledOrderIds.size,
      },
      dailyStats: Array.from(dailyStatsMap.values()).sort((left, right) => right.date.localeCompare(left.date)),
      recentOrders: Array.from(recentOrdersById.values()).slice(0, 12).map((order) => ({
        id: order.id,
        orderCode: order.orderCode ?? null,
        status: order.status,
        totalAmount: Number(order.totalAmount || 0),
        updatedAt: order.updatedAt,
      })),
      activityLogs: recentLogs.map((log) => ({
        id: log.id,
        orderId: log.orderId,
        orderCode: log.order?.orderCode ?? null,
        fromStatus: log.fromStatus,
        toStatus: log.toStatus,
        note: log.note ?? null,
        createdAt: log.createdAt,
      })),
    };
  }
}
