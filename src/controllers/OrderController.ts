import { Request, Response, NextFunction } from 'express';
import { injectable } from 'tsyringe';
import { OrderService } from '@services/OrderService';
import { CreateOrderDto } from '@dtos/order/CreateOrderDto';

@injectable()
export class OrderController {
  constructor(private orderService: OrderService) {}

  /**
   * POST /orders
   * Checkout toàn bộ Cart → tạo Order mới.
   * Body: { addressId, shippingFee?, note? }
   */
  createOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const dto = req.body as CreateOrderDto;

      const order = await this.orderService.createOrder(userId, dto);

      res.status(201).json({
        success: true,
        data: order,
        message: 'Đặt hàng thành công',
      });
    } catch (error) {
      next(error);
    }
  };

  createGuestOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const dto = req.body as CreateOrderDto;
      const order = await this.orderService.createGuestOrder(dto);

      res.status(201).json({
        success: true,
        data: order,
        message: 'Đặt hàng thành công',
      });
    } catch (error) {
      next(error);
    }
  };

  trackOrder = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const orderCode = String(req.query.orderCode || '').trim();

      if (!orderCode) {
        res.status(400).json({
          success: false,
          message: 'Vui lòng nhập mã đơn hàng',
        });
        return;
      }

      const order = await this.orderService.trackOrder(orderCode);

      res.status(200).json({
        success: true,
        data: order,
        message: 'Lấy thông tin đơn hàng thành công',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /orders/my?page=1&limit=10
   * Lấy danh sách đơn hàng của user đang đăng nhập (có phân trang).
   */
  getMyOrders = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 10));

      const result = await this.orderService.getMyOrders(userId, page, limit);

      res.status(200).json({
        success: true,
        data: result,
        message: 'Lấy danh sách đơn hàng thành công',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * GET /orders/:id
   * Lấy chi tiết đơn hàng theo id — chỉ trả về nếu thuộc về user hiện tại.
   */
  getOrderById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;

      const order = await this.orderService.getOrderById(userId, id);

      res.status(200).json({
        success: true,
        data: order,
        message: 'Lấy thông tin đơn hàng thành công',
      });
    } catch (error) {
      next(error);
    }
  };
}
