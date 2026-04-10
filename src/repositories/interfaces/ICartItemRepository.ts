import { CartItem } from '@entities/CartItem';

export interface ICartItemRepository {
  /**
   * Tìm item trong 1 giỏ hàng cụ thể theo bookId.
   */
  findByCartAndBook(cartId: string, bookId: string): Promise<CartItem | null>;

  /**
   * Thêm item vào giỏ hàng.
   */
  addCartItem(cartId: string, bookId: string, quantity: number): Promise<CartItem>;

  /**
   * Cập nhật số lượng của item.
   */
  updateQuantity(cartItemId: string, newQuantity: number): Promise<CartItem>;

  /**
   * Xóa item khỏi giỏ.
   */
  removeCartItem(cartItemId: string): Promise<void>;
  
  /**
   * Tìm item theo ID.
   */
  findById(cartItemId: string): Promise<CartItem | null>;
}
