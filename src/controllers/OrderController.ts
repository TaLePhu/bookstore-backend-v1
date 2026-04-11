import { Request, Response, NextFunction } from 'express';
import { OrderService } from '@services/OrderService';
import { CreateOrderDto } from '@dtos/order/CreateOrderDto';

const orderService = new OrderService();

export class OrderController {
  /**
   * POST /orders
   * Checkout toàn bộ Cart → tạo Order mới.
   * Body: { addressId, shippingFee?, note? }
   */
  static async createOrder(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const dto = req.body as CreateOrderDto;

      const order = await orderService.createOrder(userId, dto);

      res.status(201).json({
        success: true,
        data: order,
        message: 'Đặt hàng thành công',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /orders/my?page=1&limit=10
   * Lấy danh sách đơn hàng của user đang đăng nhập (có phân trang).
   */
  static async getMyOrders(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string) || 10));

      const result = await orderService.getMyOrders(userId, page, limit);

      res.status(200).json({
        success: true,
        data: result,
        message: 'Lấy danh sách đơn hàng thành công',
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * GET /orders/:id
   * Lấy chi tiết đơn hàng theo id — chỉ trả về nếu thuộc về user hiện tại.
   */
  static async getOrderById(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.userId;
      const { id } = req.params;

      const order = await orderService.getOrderById(userId, id);

      res.status(200).json({
        success: true,
        data: order,
        message: 'Lấy thông tin đơn hàng thành công',
      });
    } catch (error) {
      next(error);
    }
  }
}
