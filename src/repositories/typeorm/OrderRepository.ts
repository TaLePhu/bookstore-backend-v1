import { Repository } from 'typeorm';
import { AppDataSource } from '@config/data-source';
import { Order, OrderStatus } from '@entities/Order';
import { OrderStatusLog } from '@entities/OrderStatusLog';
import { PaymentMethod, PaymentStatus } from '@entities/Payment';
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
      relations: ['items', 'items.book', 'items.book.images', 'address', 'statusLogs'],
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return { orders, total };
  }

  async findByIdAndUserId(orderId: string, userId: string): Promise<Order | null> {
    return await this.repository.findOne({
      where: { id: orderId, userId },
      relations: ['items', 'items.book', 'items.book.images', 'address', 'payments', 'statusLogs', 'statusLogs.changedByUser'],
    });
  }

  async findAllForManagement(params: {
    page: number;
    limit: number;
    status?: OrderStatus;
    q?: string;
    cancelRequested?: boolean;
    paymentMethod?: PaymentMethod;
    paymentStatus?: PaymentStatus;
    dateFrom?: Date;
    dateTo?: Date;
  }): Promise<{ orders: AdminOrderListItem[]; total: number }> {
    const { page, limit, status, q, cancelRequested, paymentMethod, paymentStatus, dateFrom, dateTo } = params;
    const skip = (page - 1) * limit;
    const cancelRequestExistsSql = `EXISTS (
      SELECT 1
      FROM order_status_logs cancel_log
      WHERE cancel_log.order_id = order_entity.id
        AND cancel_log.from_status = cancel_log.to_status
        AND cancel_log.changed_by IS NULL
        AND (
          cancel_log.note ILIKE '%yÃªu cáº§u há»§y%'
          OR cancel_log.note ILIKE '%yÄ‚Âªu cÃ¡ÂºÂ§u hÃ¡Â»Â§y%'
          OR cancel_log.note ILIKE 'KhÃ¡ch yÃªu cáº§u há»§y:%'
          OR cancel_log.note ILIKE 'KhÄ‚Â¡ch yÄ‚Âªu cÃ¡ÂºÂ§u hÃ¡Â»Â§y:%'
        )
        AND order_entity.status IN ('PENDING', 'PROCESSING')
        AND NOT EXISTS (
          SELECT 1
          FROM order_status_logs resolve_log
          WHERE resolve_log.order_id = order_entity.id
            AND resolve_log.changed_by IS NOT NULL
            AND resolve_log.created_at > cancel_log.created_at
            AND (
              resolve_log.to_status = 'CANCELLED'
              OR (
                resolve_log.from_status = resolve_log.to_status
                AND (
                  resolve_log.note ILIKE 'Admin tá»« chá»‘i yÃªu cáº§u há»§y:%'
                  OR resolve_log.note ILIKE 'Admin tu choi yeu cau huy:%'
                )
              )
            )
        )
    )`;

    const qb = this.repository
      .createQueryBuilder('order_entity')
      .leftJoin('order_entity.user', 'user')
      .leftJoin('order_entity.address', 'address')
      .leftJoin('order_entity.payments', 'payment')
      .select('order_entity.id', 'id')
      .addSelect('order_entity.orderCode', 'orderCode')
      .addSelect('order_entity.createdAt', 'createdAt')
      .addSelect('order_entity.totalAmount', 'totalAmount')
      .addSelect('order_entity.status', 'status')
      .addSelect('user.fullName', 'customerName')
      .addSelect('user.userName', 'customerUserName')
      .addSelect('user.email', 'customerEmail')
      .addSelect('address.phone', 'customerPhone')
      .addSelect(
        `NULLIF(CONCAT_WS(', ', address.address_line, address.ward_name, address.district_name, address.province_name), '')`,
        'addressSummary'
      )
      .addSelect('MAX(payment.method::text)', 'paymentMethod')
      .addSelect('MAX(payment.status::text)', 'paymentStatus')
      .addSelect(
        `(SELECT COALESCE(SUM(order_item.quantity), 0) FROM order_items order_item WHERE order_item.order_id = order_entity.id)`,
        'totalItems'
      )
      .addSelect(
        `(
          SELECT COUNT(1)
          FROM order_status_logs cancel_log
          WHERE cancel_log.order_id = order_entity.id
            AND cancel_log.from_status = cancel_log.to_status
            AND cancel_log.changed_by IS NULL
            AND (
              cancel_log.note ILIKE '%yêu cầu hủy%'
              OR cancel_log.note ILIKE '%yĂªu cáº§u há»§y%'
              OR cancel_log.note ILIKE 'Khách yêu cầu hủy:%'
              OR cancel_log.note ILIKE 'KhĂ¡ch yĂªu cáº§u há»§y:%'
            )
            AND order_entity.status IN ('PENDING', 'PROCESSING')
            AND NOT EXISTS (
              SELECT 1
              FROM order_status_logs resolve_log
              WHERE resolve_log.order_id = order_entity.id
                AND resolve_log.changed_by IS NOT NULL
                AND resolve_log.created_at > cancel_log.created_at
                AND (
                  resolve_log.to_status = 'CANCELLED'
                  OR (
                    resolve_log.from_status = resolve_log.to_status
                    AND (
                      resolve_log.note ILIKE 'Admin từ chối yêu cầu hủy:%'
                      OR resolve_log.note ILIKE 'Admin tu choi yeu cau huy:%'
                    )
                  )
                )
            )
        )`,
        'cancelRequested'
      )
      .groupBy('order_entity.id')
      .addGroupBy('user.id')
      .addGroupBy('address.id')
      .orderBy('order_entity.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    if (status) {
      qb.andWhere('order_entity.status = :status', { status });
    }

    if (q?.trim()) {
      qb.andWhere(
        `(order_entity.orderCode ILIKE :keyword
          OR user.fullName ILIKE :keyword
          OR user.userName ILIKE :keyword
          OR user.email ILIKE :keyword
          OR address.phone ILIKE :keyword)`,
        { keyword: `%${q.trim()}%` }
      );
    }

    if (cancelRequested) {
      qb.andWhere(cancelRequestExistsSql);
    }

    if (paymentMethod) {
      qb.andWhere('payment.method = :paymentMethod', { paymentMethod });
    }

    if (paymentStatus) {
      qb.andWhere('payment.status = :paymentStatus', { paymentStatus });
    }

    if (dateFrom) {
      qb.andWhere('order_entity.createdAt >= :dateFrom', { dateFrom });
    }

    if (dateTo) {
      qb.andWhere('order_entity.createdAt <= :dateTo', { dateTo });
    }

    const rows = await qb.getRawMany<AdminOrderListItem>();
    const totalQb = this.repository
      .createQueryBuilder('order_entity')
      .leftJoin('order_entity.user', 'user')
      .leftJoin('order_entity.address', 'address')
      .leftJoin('order_entity.payments', 'payment');

    if (status) {
      totalQb.andWhere('order_entity.status = :status', { status });
    }

    if (q?.trim()) {
      totalQb.andWhere(
        `(order_entity.orderCode ILIKE :keyword
          OR user.fullName ILIKE :keyword
          OR user.userName ILIKE :keyword
          OR user.email ILIKE :keyword
          OR address.phone ILIKE :keyword)`,
        { keyword: `%${q.trim()}%` }
      );
    }

    if (cancelRequested) {
      totalQb.andWhere(cancelRequestExistsSql);
    }

    if (paymentMethod) {
      totalQb.andWhere('payment.method = :paymentMethod', { paymentMethod });
    }

    if (paymentStatus) {
      totalQb.andWhere('payment.status = :paymentStatus', { paymentStatus });
    }

    if (dateFrom) {
      totalQb.andWhere('order_entity.createdAt >= :dateFrom', { dateFrom });
    }

    if (dateTo) {
      totalQb.andWhere('order_entity.createdAt <= :dateTo', { dateTo });
    }

    const total = await totalQb.getCount();

    const orders = rows.map((row) => ({
      id: row.id,
      orderCode: row.orderCode ?? null,
      customerName: row.customerName ?? null,
      customerUserName: row.customerUserName ?? null,
      customerEmail: row.customerEmail ?? null,
      customerPhone: row.customerPhone ?? null,
      addressSummary: row.addressSummary ?? null,
      paymentMethod: row.paymentMethod ?? null,
      paymentStatus: row.paymentStatus ?? null,
      createdAt: new Date(row.createdAt),
      totalItems: Number(row.totalItems ?? 0),
      totalAmount: Number(row.totalAmount ?? 0),
      status: row.status,
      cancelRequested: Boolean(Number((row as any).cancelRequested ?? 0)),
    }));

    return { orders, total };
  }

  async findById(orderId: string): Promise<Order | null> {
    return await this.repository.findOne({
      where: { id: orderId },
      relations: ['items', 'items.book', 'items.book.images', 'address', 'user', 'payments', 'statusLogs', 'statusLogs.changedByUser'],
    });
  }

  async findByOrderCode(orderCode: string): Promise<Order | null> {
    return await this.repository.findOne({
      where: { orderCode },
      relations: ['items', 'items.book', 'items.book.images', 'address', 'user', 'payments', 'statusLogs', 'statusLogs.changedByUser'],
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
      .createQueryBuilder('order_entity')
      .leftJoin('order_entity.user', 'user')
      .leftJoin('order_entity.address', 'address')
      .select('order_entity.id', 'id')
      .addSelect('order_entity.orderCode', 'orderCode')
      .addSelect('order_entity.createdAt', 'createdAt')
      .addSelect('order_entity.totalAmount', 'totalAmount')
      .addSelect('order_entity.status', 'status')
      .orderBy('order_entity.createdAt', 'DESC');

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
