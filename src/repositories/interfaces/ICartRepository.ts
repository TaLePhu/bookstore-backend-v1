import { Cart } from '@entities/Cart';

export interface ICartRepository {
  /**
   * Lấy giỏ hàng mới nhất chưa thanh toán của user.
   */
  findActiveByUserId(userId: string): Promise<Cart | null>;

  /**
   * Khởi tạo giỏ hàng mới cho user.
   */
  createCart(userId: string): Promise<Cart>;
}
