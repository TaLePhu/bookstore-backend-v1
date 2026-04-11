import { Order } from '@entities/Order';

export interface IOrderRepository {
  /**
   * Tìm danh sách đơn hàng của user với phân trang.
   */
  findByUserId(
    userId: string,
    page: number,
    limit: number
  ): Promise<{ orders: Order[]; total: number }>;

  /**
   * Tìm đơn hàng theo id VÀ userId — đảm bảo phân quyền.
   * Trả về null nếu không tìm thấy hoặc không thuộc về user.
   */
  findByIdAndUserId(orderId: string, userId: string): Promise<Order | null>;
}
