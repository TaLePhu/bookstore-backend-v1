import { injectable, inject } from 'tsyringe';
import { ICartRepository } from '@repositories/interfaces/ICartRepository';
import { ICartItemRepository } from '@repositories/interfaces/ICartItemRepository';
import { IBookRepository } from '@repositories/interfaces/IBookRepository';
import { AddToCartDto } from '@dtos/cart/AddToCartDto';
import { UpdateCartItemDto } from '@dtos/cart/UpdateCartItemDto';
import { Cart } from '@entities/Cart';
import { BehaviorType, UserBehavior } from '@entities/UserBehavior';
import { NotFoundError, AppError } from '@utils/errors';
import { TOKENS } from '@config/container';
import { AppDataSource } from '@config/data-source';

@injectable()
export class CartService {
  constructor(
    @inject(TOKENS.CART_REPOSITORY) private cartRepository: ICartRepository,
    @inject(TOKENS.CART_ITEM_REPOSITORY) private cartItemRepository: ICartItemRepository,
    @inject(TOKENS.BOOK_REPOSITORY) private bookRepository: IBookRepository
  ) {}

  /**
   * Lấy giỏ hàng hiện tại của user.
   * Nếu chưa có giỏ, tự động tạo mới (giỏ rỗng).
   */
  async getCart(userId: string): Promise<Cart> {
    let cart = await this.cartRepository.findActiveByUserId(userId);

    if (!cart) {
      cart = await this.cartRepository.createCart(userId);
      cart.items = [];
    }

    return cart;
  }

  /**
   * Thêm sản phẩm vào giỏ hàng.
   * - Kiểm tra sách có tồn tại không.
   * - Kiểm tra số lượng tồn kho.
   * - Nếu sách đã có trong giỏ → cộng dồn số lượng.
   * - Nếu chưa có → tạo CartItem mới.
   */
  async addToCart(userId: string, dto: AddToCartDto): Promise<Cart> {
    // 1. Kiểm tra sách tồn tại
    const book = await this.bookRepository.findById(dto.bookId);
    if (!book) {
      throw new NotFoundError('Sách không tồn tại');
    }

    // 2. Kiểm tra số lượng yêu cầu với tồn kho
    if (book.stock < dto.quantity) {
      throw new AppError(
        `Số lượng yêu cầu (${dto.quantity}) vượt quá tồn kho hiện tại (${book.stock})`,
        400
      );
    }

    // 3. Lấy hoặc tạo mới giỏ hàng
    const cart = await this.getCart(userId);

    // 4. Kiểm tra sách đã có trong giỏ chưa
    const existingItem = await this.cartItemRepository.findByCartAndBook(cart.id, dto.bookId);

    if (existingItem) {
      // Đã có → cộng dồn số lượng
      const newQuantity = existingItem.quantity + dto.quantity;

      if (book.stock < newQuantity) {
        throw new AppError(
          `Tổng số lượng trong giỏ (${newQuantity}) vượt quá tồn kho hiện tại (${book.stock})`,
          400
        );
      }

      await this.cartItemRepository.updateQuantity(existingItem.id, newQuantity);
    } else {
      // Chưa có → tạo item mới
      await this.cartItemRepository.addCartItem(cart.id, dto.bookId, dto.quantity);
    }

    // 5. Trả về giỏ hàng mới nhất (đã có items mới)
    await this.recordCartBehavior(userId, dto.bookId, dto.quantity);
    return (await this.cartRepository.findActiveByUserId(userId))!;
  }

  private async recordCartBehavior(userId: string, bookId: string, quantity: number): Promise<void> {
    try {
      const behaviorRepo = AppDataSource.getRepository(UserBehavior);
      await behaviorRepo.save(
        behaviorRepo.create({
          userId,
          bookId,
          behaviorType: BehaviorType.ADD_TO_CART,
          metadata: { quantity },
        })
      );
    } catch (error) {
      console.warn('Record add-to-cart behavior failed:', error);
    }
  }

  /**
   * Cập nhật số lượng của một CartItem.
   * - Nếu quantity <= 0 → xóa item khỏi giỏ.
   * - Kiểm tra quyền sở hữu: item phải thuộc giỏ hàng của user.
   */
  async updateCartItem(userId: string, itemId: string, dto: UpdateCartItemDto): Promise<Cart> {
    // 1. Tìm item
    const item = await this.cartItemRepository.findById(itemId);
    if (!item) {
      throw new NotFoundError('Mục trong giỏ hàng không tồn tại');
    }

    // 2. Kiểm tra quyền sở hữu
    const cart = await this.cartRepository.findActiveByUserId(userId);
    if (!cart || item.cartId !== cart.id) {
      throw new AppError('Bạn không có quyền chỉnh sửa mục này', 403);
    }

    if (dto.quantity <= 0) {
      // Xóa luôn nếu số lượng đặt về 0 hoặc âm
      await this.cartItemRepository.removeCartItem(itemId);
    } else {
      // Kiểm tra tồn kho trước khi cập nhật
      const book = await this.bookRepository.findById(item.bookId);
      if (!book) {
        throw new NotFoundError('Sách không còn tồn tại');
      }

      if (book.stock < dto.quantity) {
        throw new AppError(
          `Số lượng cập nhật (${dto.quantity}) vượt quá tồn kho hiện tại (${book.stock})`,
          400
        );
      }

      await this.cartItemRepository.updateQuantity(itemId, dto.quantity);
    }

    // Trả về giỏ hàng đã được cập nhật
    const updatedCart = await this.cartRepository.findActiveByUserId(userId);
    return updatedCart ?? { ...cart, items: [] };
  }

  /**
   * Xóa một sản phẩm khỏi giỏ hàng.
   * Kiểm tra quyền sở hữu: item phải thuộc giỏ hàng của user.
   */
  async removeCartItem(userId: string, itemId: string): Promise<Cart> {
    // 1. Tìm item
    const item = await this.cartItemRepository.findById(itemId);
    if (!item) {
      throw new NotFoundError('Mục trong giỏ hàng không tồn tại');
    }

    // 2. Kiểm tra quyền sở hữu
    const cart = await this.cartRepository.findActiveByUserId(userId);
    if (!cart || item.cartId !== cart.id) {
      throw new AppError('Bạn không có quyền xóa mục này', 403);
    }

    await this.cartItemRepository.removeCartItem(itemId);

    // Trả về giỏ hàng sau khi xóa
    const updatedCart = await this.cartRepository.findActiveByUserId(userId);
    return updatedCart ?? { ...cart, items: [] };
  }
}
