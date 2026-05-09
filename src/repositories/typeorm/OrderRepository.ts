import { Repository } from 'typeorm';
import { AppDataSource } from '@config/data-source';
import { Order, OrderStatus } from '@entities/Order';
import { OrderStatusLog } from '@entities/OrderStatusLog';
import {
  IOrderRepository,
  AdminOrderListItem,
  CustomerOrderHistoryItem,
} from '@repositories/interfaces/IOrderRepository';

export class OrderRepository implements IOrderRepository {
  private repository: Repository<Order>;

  constructor() {
    this.repository = AppDataSource.getRepository(Order);
  }

  async findByUserId(
    userId: string,
    page: number,
    limit: number
  ): Promise<{ orders: Order[]; total: number }> {
    const skip = (page - 1) * limit;

    const [orders, total] = await this.repository.findAndCount({
      where: { userId },
      relations: ['items', 'items.book', 'items.book.images', 'address'],
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return { orders, total };
  }

  async findByIdAndUserId(orderId: string, userId: string): Promise<Order | null> {
    return await this.repository.findOne({
      where: { id: orderId, userId },
      relations: ['items', 'items.book', 'items.book.images', 'address'],
    });
  }

  async findAllForManagement(params: {
    page: number;
    limit: number;
    status?: OrderStatus;
  }): Promise<{ orders: AdminOrderListItem[]; total: number }> {
    const { page, limit, status } = params;
    const skip = (page - 1) * limit;

    const qb = this.repository
      .createQueryBuilder('order')
      .leftJoin('order.user', 'user')
      .leftJoin('order.items', 'item')
      .select('order.id', 'id')
      .addSelect('order.orderCode', 'orderCode')
      .addSelect('order.createdAt', 'createdAt')
      .addSelect('order.totalAmount', 'totalAmount')
      .addSelect('order.status', 'status')
      .addSelect('user.fullName', 'customerName')
      .addSelect('user.userName', 'customerUserName')
      .addSelect('user.email', 'customerEmail')
      .addSelect('COALESCE(SUM(item.quantity), 0)', 'totalItems')
      .groupBy('order.id')
      .addGroupBy('user.id')
      .orderBy('order.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (status) {
      qb.andWhere('order.status = :status', { status });
    }

    const rows = await qb.getRawMany<AdminOrderListItem>();
    const total = await this.repository.count({
      where: status ? { status } : {},
    });

    const orders = rows.map((row) => ({
      id: row.id,
      orderCode: row.orderCode ?? null,
      customerName: row.customerName ?? null,
      customerUserName: row.customerUserName ?? null,
      customerEmail: row.customerEmail ?? null,
      createdAt: new Date(row.createdAt),
      totalItems: Number(row.totalItems ?? 0),
      totalAmount: Number(row.totalAmount ?? 0),
      status: row.status,
    }));

    return { orders, total };
  }

  async findById(orderId: string): Promise<Order | null> {
    return await this.repository.findOne({
      where: { id: orderId },
      relations: ['items', 'items.book', 'items.book.images', 'address', 'user', 'payments'],
    });
  }

  async findByOrderCode(orderCode: string): Promise<Order | null> {
    return await this.repository.findOne({
      where: { orderCode },
      relations: ['items', 'items.book', 'items.book.images', 'address', 'user', 'payments'],
    });
  }

  async countByStatus(status: OrderStatus): Promise<number> {
    return await this.repository.count({ where: { status } });
  }

  async countStaffPackedInRange(staffId: string, start: Date, end: Date): Promise<number> {
    const logRepo = AppDataSource.getRepository(OrderStatusLog);
    return await logRepo
      .createQueryBuilder('log')
      .where('log.changedBy = :staffId', { staffId })
      .andWhere('log.toStatus = :status', { status: OrderStatus.SHIPPED })
      .andWhere('log.createdAt >= :start AND log.createdAt < :end', { start, end })
      .getCount();
  }

  async findCustomerHistory(params: {
    email?: string;
    phone?: string;
  }): Promise<CustomerOrderHistoryItem[]> {
    const { email, phone } = params;
    const qb = this.repository
      .createQueryBuilder('order')
      .leftJoin('order.user', 'user')
      .leftJoin('order.address', 'address')
      .select('order.id', 'id')
      .addSelect('order.orderCode', 'orderCode')
      .addSelect('order.createdAt', 'createdAt')
      .addSelect('order.totalAmount', 'totalAmount')
      .addSelect('order.status', 'status')
      .orderBy('order.createdAt', 'DESC');

    if (email && phone) {
      qb.where('(user.email = :email OR address.phone = :phone)', { email, phone });
    } else if (email) {
      qb.where('user.email = :email', { email });
    } else if (phone) {
      qb.where('address.phone = :phone', { phone });
    }

    const rows = await qb.getRawMany<CustomerOrderHistoryItem>();
    return rows.map((row) => ({
      id: row.id,
      orderCode: row.orderCode ?? null,
      createdAt: new Date(row.createdAt),
      totalAmount: Number(row.totalAmount ?? 0),
      status: row.status,
    }));
  }
}
