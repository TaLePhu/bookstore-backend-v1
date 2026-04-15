import { AppDataSource } from '@config/data-source';
import { injectable, inject } from 'tsyringe';
import { Order, OrderStatus } from '@entities/Order';
import { OrderItem } from '@entities/OrderItem';
import { Book } from '@entities/Book';
import { CartItem } from '@entities/CartItem';
import { Address } from '@entities/Address';
import { Payment, PaymentMethod, PaymentStatus } from '@entities/Payment';
import { Cart } from '@entities/Cart';
import { IOrderRepository } from '@repositories/interfaces/IOrderRepository';
import { ICartRepository } from '@repositories/interfaces/ICartRepository';
import { CreateOrderDto } from '@dtos/order/CreateOrderDto';
import { AppError, NotFoundError } from '@utils/errors';
import { EntityManager } from 'typeorm';
import { TOKENS } from '@config/container';

@injectable()
export class OrderService {
  constructor(
    @inject(TOKENS.ORDER_REPOSITORY) private orderRepository: IOrderRepository,
    @inject(TOKENS.CART_REPOSITORY) private cartRepository: ICartRepository
  ) {}

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

    // 2. Validate CartItems: If cartItemIds is provided, check if these items exist in cart
    let orderItemsData = cart.items;
    if (dto.cartItemIds && dto.cartItemIds.length > 0) {
      orderItemsData = cart.items.filter((item) => dto.cartItemIds!.includes(item.id));
      if (orderItemsData.length !== dto.cartItemIds.length) {
        throw new AppError('Một số sản phẩm không tồn tại trong giỏ hàng', 400);
      }
    }

    // 3. Resolve Address
    const addressRepo = AppDataSource.getRepository(Address);
    let addressId = dto.addressId;
    if (addressId) {
      const address = await addressRepo.findOne({
        where: { id: addressId, userId },
      });
      if (!address) {
        throw new NotFoundError('Địa chỉ không tồn tại hoặc không thuộc về bạn');
      }
    } else {
      // Validate inline address
      if (!dto.addressLine || !dto.phone || !dto.receiverName) {
        throw new AppError('Vui lòng cung cấp cả addressId hoặc thông tin địa chỉ đầy đủ (addressLine, phone, receiverName)', 400);
      }
      const newAddress = addressRepo.create({
        userId,
        country: dto.country ?? 'VN',
        provinceCode: dto.provinceCode,
        provinceName: dto.provinceName,
        districtCode: dto.districtCode,
        districtName: dto.districtName,
        wardCode: dto.wardCode,
        wardName: dto.wardName,
        addressLine: dto.addressLine,
        phone: dto.phone,
        receiverName: dto.receiverName,
      });
      const savedAddress = await addressRepo.save(newAddress);
      addressId = savedAddress.id;
    }

    // 4. Transaction: khóa stock, tạo Order, trừ stock, xoá phần cartItems tương ứng
    const savedOrder = await AppDataSource.transaction(async (manager: EntityManager) => {
      // Reload cart items trong transaction
      const txCart = await manager.findOne(Cart, {
        where: { id: cart.id, userId },
        relations: ['items'],
      });

      if (!txCart || !txCart.items || txCart.items.length === 0) {
        throw new AppError('Giỏ hàng không hợp lệ', 400);
      }

      // Xác định các cart items sẽ checkout
      const txOrderItems = dto.cartItemIds && dto.cartItemIds.length > 0
        ? txCart.items.filter((item) => dto.cartItemIds!.includes(item.id))
        : txCart.items;

      if (txOrderItems.length === 0) {
        throw new AppError('Không có sản phẩm nào để thanh toán', 400);
      }

      const shippingFee = dto.shippingFee ?? 0;
      const itemsData: Array<{ bookId: string; quantity: number; price: number; subTotal: number }> = [];

      for (const cartItem of txOrderItems) {
        const lockedBook = await manager.findOne(Book, {
          where: { id: cartItem.bookId },
          lock: { mode: 'pessimistic_write' },
        });

        if (!lockedBook) {
          throw new NotFoundError('Sách trong giỏ hàng không còn tồn tại');
        }

        if (lockedBook.stock < cartItem.quantity) {
          throw new AppError(
            `Sách "${lockedBook.title}" chỉ còn ${lockedBook.stock} cuốn trong kho (bạn đang chọn ${cartItem.quantity})`,
            400
          );
        }

        const price = Number(lockedBook.price);
        itemsData.push({
          bookId: lockedBook.id,
          quantity: cartItem.quantity,
          price,
          subTotal: cartItem.quantity * price,
        });
      }

      const totalAmount = itemsData.reduce((sum, item) => sum + item.subTotal, 0) + shippingFee;

      // Tạo Order entity nối với Payment
      const order = manager.create(Order, {
        userId,
        addressId: addressId!,
        totalAmount,
        shippingFee,
        note: dto.note ?? null,
        status: OrderStatus.PENDING,
      });
      const createdOrder = await manager.save(Order, order);

      // Tạo Payment record
      const paymentMethod = dto.paymentMethod ?? PaymentMethod.COD;
      const payment = manager.create(Payment, {
        orderId: createdOrder.id,
        amount: totalAmount,
        method: paymentMethod,
        status: PaymentStatus.PENDING,
      });
      await manager.save(Payment, payment);

      // Tạo OrderItems (cascade lưu cùng order)
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

      // Trừ stock của từng Book
      for (const item of itemsData) {
        await manager.decrement(Book, { id: item.bookId }, 'stock', item.quantity);
      }

      // Xoá các CartItems đã thanh toán
      for (const cartItem of txOrderItems) {
        await manager.delete(CartItem, { id: cartItem.id });
      }

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
