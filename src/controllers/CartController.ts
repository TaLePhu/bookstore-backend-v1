import { Request, Response, NextFunction } from 'express';
import { injectable } from 'tsyringe';
import { CartService } from '@services/CartService';
import { AddToCartDto } from '@dtos/cart/AddToCartDto';
import { UpdateCartItemDto } from '@dtos/cart/UpdateCartItemDto';

@injectable()
export class CartController {
  constructor(private cartService: CartService) {}

  /**
   * GET /cart
   * Lấy giỏ hàng của user đang đăng nhập.
   */
  getCart = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const cart = await this.cartService.getCart(userId);

      res.status(200).json({
        success: true,
        data: cart,
        message: 'Lấy giỏ hàng thành công',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * POST /cart/add
   * Thêm sách vào giỏ hàng.
   * Body: { bookId: string, quantity: number }
   */
  addToCart = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const dto = req.body as AddToCartDto;

      const cart = await this.cartService.addToCart(userId, dto);

      res.status(200).json({
        success: true,
        data: cart,
        message: 'Thêm sản phẩm vào giỏ hàng thành công',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * PUT /cart/update/:itemId
   * Cập nhật số lượng của một mục trong giỏ hàng.
   * Params: itemId
   * Body: { quantity: number }
   */
  updateCartItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const { itemId } = req.params;
      const dto = req.body as UpdateCartItemDto;

      const cart = await this.cartService.updateCartItem(userId, itemId, dto);

      res.status(200).json({
        success: true,
        data: cart,
        message: 'Cập nhật giỏ hàng thành công',
      });
    } catch (error) {
      next(error);
    }
  };

  /**
   * DELETE /cart/remove/:itemId
   * Xóa một mục khỏi giỏ hàng.
   * Params: itemId
   */
  removeCartItem = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const { itemId } = req.params;

      const cart = await this.cartService.removeCartItem(userId, itemId);

      res.status(200).json({
        success: true,
        data: cart,
        message: 'Xóa sản phẩm khỏi giỏ hàng thành công',
      });
    } catch (error) {
      next(error);
    }
  };
}
