import { Request, Response, NextFunction } from 'express';
import { injectable } from 'tsyringe';
import { AdminOrderService } from '@services/AdminOrderService';
import { OrderStatus } from '@entities/Order';
import { PaymentMethod, PaymentStatus } from '@entities/Payment';
import { AppError } from '@utils/errors';
import { UpdateOrderStatusDto } from '@dtos/admin/UpdateOrderStatusDto';
import { RejectCancelRequestDto } from '@dtos/admin/RejectCancelRequestDto';

function getSafePagination(pageValue: unknown, limitValue: unknown): { page: number; limit: number } {
  const parsedPage = parseInt(String(pageValue ?? ''), 10);
  const parsedLimit = parseInt(String(limitValue ?? ''), 10);

  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const limit = Number.isFinite(parsedLimit) ? Math.min(50, Math.max(1, parsedLimit)) : 10;

  return { page, limit };
}

function isUuid(value: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

function parseStatus(value?: string): OrderStatus | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toUpperCase();
  const values = Object.values(OrderStatus) as string[];
  if (!values.includes(normalized)) {
    throw new AppError('Trang thai don hang khong hop le', 400);
  }
  return normalized as OrderStatus;
}

function parsePaymentMethod(value?: string): PaymentMethod | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toUpperCase();
  const values = Object.values(PaymentMethod) as string[];
  if (!values.includes(normalized)) {
    throw new AppError('Phuong thuc thanh toan khong hop le', 400);
  }
  return normalized as PaymentMethod;
}

function parsePaymentStatus(value?: string): PaymentStatus | undefined {
  if (!value) return undefined;
  const normalized = value.trim().toUpperCase();
  const values = Object.values(PaymentStatus) as string[];
  if (!values.includes(normalized)) {
    throw new AppError('Trang thai thanh toan khong hop le', 400);
  }
  return normalized as PaymentStatus;
}

function parseDate(value?: string, endOfDay = false): Date | undefined {
  if (!value) return undefined;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new AppError('Ngay loc khong hop le', 400);
  }
  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  }
  return date;
}

@injectable()
export class AdminOrderController {
  constructor(private adminOrderService: AdminOrderService) {}

  listOrders = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { page, limit } = getSafePagination(req.query.page, req.query.limit);
      const status = typeof req.query.status === 'string' ? parseStatus(req.query.status) : undefined;
      const q = typeof req.query.q === 'string' ? req.query.q.trim() : undefined;
      const cancelRequested = req.query.cancelRequested === 'true';
      const paymentMethod =
        typeof req.query.paymentMethod === 'string' ? parsePaymentMethod(req.query.paymentMethod) : undefined;
      const paymentStatus =
        typeof req.query.paymentStatus === 'string' ? parsePaymentStatus(req.query.paymentStatus) : undefined;
      const dateFrom = typeof req.query.dateFrom === 'string' ? parseDate(req.query.dateFrom) : undefined;
      const dateTo = typeof req.query.dateTo === 'string' ? parseDate(req.query.dateTo, true) : undefined;

      const result = await this.adminOrderService.listOrders({
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

      res.status(200).json({
        success: true,
        data: result.data,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit,
        },
      });
    } catch (error) {
      next(error);
    }
  };

  getOrderById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      if (!isUuid(id)) {
        throw new AppError('ID khong dung dinh dang UUID', 400);
      }

      const order = await this.adminOrderService.getOrderDetail(id);

      res.status(200).json({
        success: true,
        data: order,
      });
    } catch (error) {
      next(error);
    }
  };

  searchByOrderCode = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const orderCode = typeof req.query.order_code === 'string' ? req.query.order_code.trim() : '';
      if (!orderCode) {
        throw new AppError('Vui long cung cap order_code', 400);
      }

      const order = await this.adminOrderService.findByOrderCode(orderCode);

      res.status(200).json({
        success: true,
        data: order,
      });
    } catch (error) {
      next(error);
    }
  };

  updateStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      if (!isUuid(id)) {
        throw new AppError('ID khong dung dinh dang UUID', 400);
      }

      const dto = req.body as UpdateOrderStatusDto;
      const staffId = req.user!.userId;
      const order = await this.adminOrderService.updateStatus(id, staffId, dto);

      res.status(200).json({
        success: true,
        data: order,
        message: 'Cap nhat trang thai don hang thanh cong',
      });
    } catch (error) {
      next(error);
    }
  };

  rejectCancelRequest = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      if (!isUuid(id)) {
        throw new AppError('ID khong dung dinh dang UUID', 400);
      }

      const dto = req.body as RejectCancelRequestDto;
      const staffId = req.user!.userId;
      const order = await this.adminOrderService.rejectCancelRequest(id, staffId, dto.note);

      res.status(200).json({
        success: true,
        data: order,
        message: 'Tu choi yeu cau huy don thanh cong',
      });
    } catch (error) {
      next(error);
    }
  };

  getStats = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const staffId = req.user!.userId;
      const stats = await this.adminOrderService.getStats(staffId);

      res.status(200).json({
        success: true,
        data: stats,
      });
    } catch (error) {
      next(error);
    }
  };

  getCustomerHistory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const email = typeof req.query.email === 'string' ? req.query.email.trim() : undefined;
      const phone = typeof req.query.phone === 'string' ? req.query.phone.trim() : undefined;

      if (!email && !phone) {
        throw new AppError('Can email hoac phone de tra cuu lich su mua hang', 400);
      }

      const history = await this.adminOrderService.getCustomerHistory({ email, phone });

      res.status(200).json({
        success: true,
        data: history,
      });
    } catch (error) {
      next(error);
    }
  };
}
