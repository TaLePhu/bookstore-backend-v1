import { AppDataSource } from '@config/data-source';
import { Order, OrderStatus } from '@entities/Order';
import { OrderItem } from '@entities/OrderItem';
import { Book } from '@entities/Book';
import { CartItem } from '@entities/CartItem';
import { Address } from '@entities/Address';
import { Cart } from '@entities/Cart';
import { OrderRepository } from '@repositories/typeorm/OrderRepository';
import { CartRepository } from '@repositories/typeorm/CartRepository';
import { CreateOrderDto } from '@dtos/order/CreateOrderDto';
import { AppError, NotFoundError } from '@utils/errors';
import { EntityManager } from 'typeorm';

export class OrderService {
  private orderRepository: OrderRepository;
  private cartRepository: CartRepository;

  constructor() {
    this.orderRepository = new OrderRepository();
    this.cartRepository = new CartRepository();
  }

  /**
   * POST /orders
   * Checkout toàn bộ Cart hiện tại → tạo Order.
   * Toàn bộ write-operations chạy trong 1 Transaction.
   */
  async createOrder(userId: string, dto: CreateOrderDto): Promise<Order> {
    // 1. Lấy Cart + CartItems (eager load book)
    const cart = await this.cartRepository.findActiveByUserId(userId);

    if (!cart || !cart.items || cart.items.length === 0) {
      throw new AppError('Giỏ hàng của bạn đang rỗng', 400);
    }

    // 2. Kiểm tra Address thuộc về user (query ngoài transaction là OK vì chỉ đọc)
    const addressRepo = AppDataSource.getRepository(Address);
    const address = await addressRepo.findOne({
      where: { id: dto.addressId, userId },
    });

    if (!address) {
      throw new NotFoundError('Địa chỉ không tồn tại hoặc không thuộc về bạn');
    }

    // 3. Kiểm tra stock TRƯỚC khi vào transaction
    for (const cartItem of cart.items) {
      const book = cartItem.book;
      if (!book) {
        throw new NotFoundError(`Sách trong giỏ hàng không còn tồn tại`);
      }
      if (book.stock < cartItem.quantity) {
        throw new AppError(
          `Sách "${book.title}" chỉ còn ${book.stock} cuốn trong kho (bạn đang chọn ${cartItem.quantity})`,
          400
        );
      }
    }

    // 4. Tính toán
    const shippingFee = dto.shippingFee ?? 0;
    const itemsData = cart.items.map((cartItem) => ({
      bookId: cartItem.bookId,
      book: cartItem.book,
      quantity: cartItem.quantity,
      price: Number(cartItem.book.price),
      subTotal: cartItem.quantity * Number(cartItem.book.price),
    }));
    const totalAmount = itemsData.reduce((sum, item) => sum + item.subTotal, 0) + shippingFee;

    // 5–7. Transaction: tạo Order, trừ stock, xoá CartItems
    const savedOrder = await AppDataSource.transaction(async (manager: EntityManager) => {
      // 5a. Tạo Order entity
      const order = manager.create(Order, {
        userId,
        addressId: dto.addressId,
        totalAmount,
        shippingFee,
        note: dto.note ?? null,
        status: OrderStatus.PENDING,
      });
      const createdOrder = await manager.save(Order, order);

      // 5b. Tạo OrderItems (cascade lưu cùng order)
      const orderItems = itemsData.map((item) =>
        manager.create(OrderItem, {
          orderId: createdOrder.id,
          bookId: item.bookId,
          quantity: item.quantity,
          price: item.price,
          subTotal: item.subTotal,
        })
      );
      await manager.save(OrderItem, orderItems);

      // 6. Trừ stock của từng Book
      for (const item of itemsData) {
        await manager.decrement(Book, { id: item.bookId }, 'stock', item.quantity);
      }

      // 7. Xoá toàn bộ CartItems của cart (giỏ hàng trở về rỗng)
      await manager.delete(CartItem, { cartId: cart.id });

      return createdOrder;
    });

    // 8. Reload Order kèm relations để trả về cho client
    const result = await this.orderRepository.findByIdAndUserId(savedOrder.id, userId);
    return result!;
  }

  /**
   * GET /orders/my
   * Lấy danh sách đơn hàng của user với phân trang.
   */
  async getMyOrders(
    userId: string,
    page: number,
    limit: number
  ): Promise<{ orders: Order[]; total: number; page: number; limit: number }> {
    const { orders, total } = await this.orderRepository.findByUserId(userId, page, limit);
    return { orders, total, page, limit };
  }

  /**
   * GET /orders/:id
   * Lấy chi tiết đơn hàng — chỉ trả về nếu thuộc về user hiện tại.
   */
  async getOrderById(userId: string, orderId: string): Promise<Order> {
    const order = await this.orderRepository.findByIdAndUserId(orderId, userId);

    if (!order) {
      throw new NotFoundError('Đơn hàng không tồn tại');
    }

    return order;
  }
}
