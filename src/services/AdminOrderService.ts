import { inject, singleton } from 'tsyringe';
import { AppDataSource } from '@config/data-source';
import { TOKENS } from '@config/container';
import { Order, OrderStatus } from '@entities/Order';
import { OrderStatusLog } from '@entities/OrderStatusLog';
import { Book } from '@entities/Book';
import { PaymentMethod, PaymentStatus } from '@entities/Payment';
import { IOrderRepository } from '@repositories/interfaces/IOrderRepository';
import { AppError, NotFoundError } from '@utils/errors';
import { UpdateOrderStatusDto } from '@dtos/admin/UpdateOrderStatusDto';

const isCustomerCancelRequestLog = (log: OrderStatusLog): boolean =>
  log.changedBy === null &&
  log.fromStatus === log.toStatus &&
  Boolean(
    log.note?.includes('yêu cầu hủy') ||
      log.note?.includes('yĂªu cáº§u há»§y') ||
      log.note?.startsWith('Khách yêu cầu hủy:') ||
      log.note?.startsWith('KhĂ¡ch yĂªu cáº§u há»§y:')
  );

const isCancelRequestResolutionLog = (log: OrderStatusLog): boolean =>
  log.changedBy !== null &&
  (log.toStatus === OrderStatus.CANCELLED ||
    Boolean(
      log.fromStatus === log.toStatus &&
        (log.note?.startsWith('Admin từ chối yêu cầu hủy:') ||
          log.note?.startsWith('Admin tu choi yeu cau huy:'))
    ));

export interface ManagementOrderListItem {
  id: string;
  orderCode: string | null;
  customerName: string;
  customerEmail: string | null;
  customerPhone: string | null;
  addressSummary: string | null;
  paymentMethod: PaymentMethod | null;
  paymentStatus: PaymentStatus | null;
  createdAt: Date;
  totalItems: number;
  totalAmount: number;
  status: OrderStatus;
  cancelRequested?: boolean;
}

@singleton()
export class AdminOrderService {
  constructor(
    @inject(TOKENS.ORDER_REPOSITORY) private orderRepository: IOrderRepository
  ) {}

  async listOrders(params: {
    page: number;
    limit: number;
    status?: OrderStatus;
    q?: string;
    cancelRequested?: boolean;
    paymentMethod?: PaymentMethod;
    paymentStatus?: PaymentStatus;
    dateFrom?: Date;
    dateTo?: Date;
  }): Promise<{ data: ManagementOrderListItem[]; total: number; page: number; limit: number }> {
    const { page, limit, status, q, cancelRequested, paymentMethod, paymentStatus, dateFrom, dateTo } = params;
    const { orders, total } = await this.orderRepository.findAllForManagement({
      page,
      limit,
      status,
      q,
      cancelRequested,
      paymentMethod,
      paymentStatus,
      dateFrom,
      dateTo,
    });

    const data = orders.map((item) => {
      const customerName = item.customerName || item.customerUserName || item.customerEmail || 'Unknown';
      return {
        id: item.id,
        orderCode: item.orderCode,
        customerName,
        customerEmail: item.customerEmail,
        customerPhone: item.customerPhone,
        addressSummary: item.addressSummary,
        paymentMethod: item.paymentMethod,
        paymentStatus: item.paymentStatus,
        createdAt: item.createdAt,
        totalItems: item.totalItems,
        totalAmount: item.totalAmount,
        status: item.status,
        cancelRequested: item.cancelRequested,
      };
    });

    return { data, total, page, limit };
  }

  async getOrderDetail(orderId: string): Promise<Order> {
    const order = await this.orderRepository.findById(orderId);
    if (!order) {
      throw new NotFoundError('Don hang khong ton tai');
    }
    return order;
  }

  async findByOrderCode(orderCode: string): Promise<Order> {
    const order = await this.orderRepository.findByOrderCode(orderCode);
    if (!order) {
      throw new NotFoundError('Khong tim thay don hang theo ma don');
    }
    return order;
  }

  async updateStatus(orderId: string, staffId: string, dto: UpdateOrderStatusDto): Promise<Order> {
    const nextStatus = dto.status;
    const note = dto.note ?? null;

    const updatedOrder = await AppDataSource.transaction(async (manager) => {
      const order = await manager
        .getRepository(Order)
        .createQueryBuilder('order_entity')
        .where('order_entity.id = :orderId', { orderId })
        .setLock('pessimistic_write')
        .getOne();

      if (!order) {
        throw new NotFoundError('Don hang khong ton tai');
      }

      if (order.status === nextStatus) {
        throw new AppError('Trang thai moi giong trang thai hien tai', 400);
      }

      const allowedTransitions: Record<OrderStatus, OrderStatus[]> = {
        [OrderStatus.PENDING]: [OrderStatus.PROCESSING, OrderStatus.CANCELLED],
        [OrderStatus.PROCESSING]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
        [OrderStatus.SHIPPED]: [OrderStatus.COMPLETED],
        [OrderStatus.COMPLETED]: [],
        [OrderStatus.CANCELLED]: [],
      };

      const allowedNext = allowedTransitions[order.status] || [];
      if (!allowedNext.includes(nextStatus)) {
        throw new AppError('Khong hop le khi chuyen trang thai don hang', 400);
      }

      if (nextStatus === OrderStatus.CANCELLED && (!note || note.trim() === '')) {
        throw new AppError('Can ghi chu ly do khi huy don', 400);
      }

      if (nextStatus === OrderStatus.CANCELLED) {
        const orderWithItems = await manager.findOne(Order, {
          where: { id: orderId },
          relations: ['items'],
        });

        const items = orderWithItems?.items ?? [];
        for (const item of items) {
          const book = await manager.findOne(Book, {
            where: { id: item.bookId },
            lock: { mode: 'pessimistic_write' },
          });

          if (!book) {
            continue;
          }

          await manager.increment(Book, { id: item.bookId }, 'stock', item.quantity);
          await manager.decrement(Book, { id: item.bookId }, 'soldCount', item.quantity);
        }
      }

      const previousStatus = order.status;
      order.status = nextStatus;
      await manager.save(Order, order);

      const log = manager.create(OrderStatusLog, {
        orderId: order.id,
        fromStatus: previousStatus,
        toStatus: nextStatus,
        note,
        changedBy: staffId,
      });
      await manager.save(OrderStatusLog, log);

      return order;
    });

    const detail = await this.orderRepository.findById(updatedOrder.id);
    return detail ?? updatedOrder;
  }

  async rejectCancelRequest(orderId: string, staffId: string, note?: string): Promise<Order> {
    const updatedOrder = await AppDataSource.transaction(async (manager) => {
      const order = await manager
        .getRepository(Order)
        .createQueryBuilder('order_entity')
        .where('order_entity.id = :orderId', { orderId })
        .setLock('pessimistic_write')
        .getOne();

      if (!order) {
        throw new NotFoundError('Don hang khong ton tai');
      }

      if (![OrderStatus.PENDING, OrderStatus.PROCESSING].includes(order.status)) {
        throw new AppError('Chi co the tu choi yeu cau huy khi don dang cho xu ly hoac dang xu ly', 400);
      }

      const logs = await manager.find(OrderStatusLog, {
        where: { orderId },
        order: { createdAt: 'DESC' },
      });
      const latestRequest = logs.find(isCustomerCancelRequestLog);
      const latestResolution = logs.find(isCancelRequestResolutionLog);

      if (!latestRequest || (latestResolution && latestResolution.createdAt > latestRequest.createdAt)) {
        throw new AppError('Don hang khong co yeu cau huy dang cho xu ly', 400);
      }

      const trimmedNote = note?.trim();
      const log = manager.create(OrderStatusLog, {
        orderId: order.id,
        fromStatus: order.status,
        toStatus: order.status,
        note: `Admin từ chối yêu cầu hủy: ${trimmedNote || 'Tiếp tục xử lý đơn hàng'}`,
        changedBy: staffId,
      });
      await manager.save(OrderStatusLog, log);

      return order;
    });

    const detail = await this.orderRepository.findById(updatedOrder.id);
    return detail ?? updatedOrder;
  }

  async getStats(staffId: string): Promise<{ totalPending: number; totalShipped: number; personalTodayPacked: number }> {
    const [totalPending, totalShipped] = await Promise.all([
      this.orderRepository.countByStatus(OrderStatus.PENDING),
      this.orderRepository.countByStatus(OrderStatus.SHIPPED),
    ]);

    const start = new Date();
    start.setHours(0, 0, 0, 0);
    const end = new Date(start);
    end.setDate(start.getDate() + 1);

    const personalTodayPacked = await this.orderRepository.countStaffPackedInRange(
      staffId,
      start,
      end
    );

    return { totalPending, totalShipped, personalTodayPacked };
  }

  async getCustomerHistory(params: { email?: string; phone?: string }) {
    return await this.orderRepository.findCustomerHistory(params);
  }
}
