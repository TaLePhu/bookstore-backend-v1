import { AppDataSource } from '@config/data-source';
import { injectable, inject } from 'tsyringe';
import { Order, OrderStatus } from '@entities/Order';
import { OrderItem } from '@entities/OrderItem';
import { Book } from '@entities/Book';
import { CartItem } from '@entities/CartItem';
import { Address } from '@entities/Address';
import { Payment, PaymentMethod, PaymentStatus } from '@entities/Payment';
import { Cart } from '@entities/Cart';
import { User, Role } from '@entities/User';
import { OrderStatusLog } from '@entities/OrderStatusLog';
import { Review } from '@entities/Review';
import { IOrderRepository } from '@repositories/interfaces/IOrderRepository';
import { ICartRepository } from '@repositories/interfaces/ICartRepository';
import { CreateOrderDto } from '@dtos/order/CreateOrderDto';
import { AppError, NotFoundError } from '@utils/errors';
import { EntityManager } from 'typeorm';
import { TOKENS } from '@config/container';
import { emailQueue } from '@config/queue';

const isCustomerCancelRequestLog = (log: OrderStatusLog): boolean =>
  log.changedBy === null &&
  log.fromStatus === log.toStatus &&
  Boolean(
    log.note?.includes('yêu cầu hủy') ||
      log.note?.includes('yĂªu cáº§u há»§y') ||
      log.note?.includes('yÄ‚Âªu cĂ¡ÂºÂ§u hĂ¡Â»Â§y') ||
      log.note?.startsWith('Khách yêu cầu hủy:') ||
      log.note?.startsWith('KhĂ¡ch yĂªu cáº§u há»§y:') ||
      log.note?.startsWith('KhÄ‚Â¡ch yÄ‚Âªu cĂ¡ÂºÂ§u hĂ¡Â»Â§y:')
  );

const isCancelRequestResolutionLog = (log: OrderStatusLog): boolean =>
  log.changedBy !== null &&
  (log.toStatus === OrderStatus.CANCELLED ||
    Boolean(
      log.fromStatus === log.toStatus &&
        (log.note?.startsWith('Admin từ chối yêu cầu hủy:') ||
          log.note?.startsWith('Admin tu choi yeu cau huy:'))
    ));

@injectable()
export class OrderService {
  constructor(
    @inject(TOKENS.ORDER_REPOSITORY) private orderRepository: IOrderRepository,
    @inject(TOKENS.CART_REPOSITORY) private cartRepository: ICartRepository
  ) {}

  async requestCancelOrder(orderCode: string, reason: string): Promise<Order> {
    const normalizedCode = orderCode.trim();
    const cancelReason = reason.trim();

    if (!normalizedCode) {
      throw new AppError('Vui lòng nhập mã đơn hàng', 400);
    }

    if (!cancelReason) {
      throw new AppError('Vui lòng nhập lý do hủy đơn hàng', 400);
    }

    if (cancelReason.length > 500) {
      throw new AppError('Lý do hủy đơn hàng tối đa 500 ký tự', 400);
    }

    const updatedOrder = await AppDataSource.transaction(async (manager: EntityManager) => {
      const order = await manager
        .getRepository(Order)
        .createQueryBuilder('order_entity')
        .where('order_entity.orderCode = :orderCode', { orderCode: normalizedCode })
        .setLock('pessimistic_write')
        .getOne();

      if (!order) {
        throw new NotFoundError('Không tìm thấy đơn hàng phù hợp');
      }

      if (![OrderStatus.PENDING, OrderStatus.PROCESSING].includes(order.status)) {
        throw new AppError('Chỉ có thể yêu cầu hủy đơn hàng khi đơn còn chờ xác nhận hoặc đang xử lý', 400);
      }

      const logs = await manager.find(OrderStatusLog, {
        where: { orderId: order.id },
        order: { createdAt: 'DESC' },
      });
      const latestRequest = logs.find(isCustomerCancelRequestLog);
      const latestResolution = logs.find(isCancelRequestResolutionLog);

      if (latestRequest && (!latestResolution || latestRequest.createdAt > latestResolution.createdAt)) {
        throw new AppError('Đơn hàng này đã có yêu cầu hủy đang chờ xử lý', 400);
      }

      const log = manager.create(OrderStatusLog, {
        orderId: order.id,
        fromStatus: order.status,
        toStatus: order.status,
        note: `Khách yêu cầu hủy: ${cancelReason}`,
        changedBy: null,
      });
      await manager.save(OrderStatusLog, log);

      return order;
    });

    const detail = await this.orderRepository.findById(updatedOrder.id);
    return detail ?? updatedOrder;
  }

  async submitOrderReview(params: {
    orderCode: string;
    bookId: string;
    rating: number;
    comment?: string;
  }): Promise<{ review: Review; bookRating: { bookId: string; rating: number; totalReviews: number } }> {
    const orderCode = params.orderCode.trim();
    const bookId = params.bookId.trim();
    const rating = Number(params.rating);
    const comment = params.comment?.trim() || null;

    if (!orderCode) {
      throw new AppError('Vui lòng nhập mã đơn hàng', 400);
    }

    if (!bookId) {
      throw new AppError('Vui lòng chọn sách cần đánh giá', 400);
    }

    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new AppError('Đánh giá phải từ 1 đến 5 sao', 400);
    }

    if (comment && comment.length > 1000) {
      throw new AppError('Nội dung đánh giá tối đa 1000 ký tự', 400);
    }

    const order = await this.orderRepository.findByOrderCode(orderCode);
    if (!order) {
      throw new NotFoundError('Không tìm thấy đơn hàng phù hợp');
    }

    if (order.status !== OrderStatus.COMPLETED) {
      throw new AppError('Chỉ có thể đánh giá sau khi đơn hàng đã hoàn thành', 400);
    }

    const purchasedItem = (order.items || []).find((item) => item.bookId === bookId);
    if (!purchasedItem) {
      throw new AppError('Sách này không thuộc đơn hàng cần đánh giá', 400);
    }

    const reviewRepo = AppDataSource.getRepository(Review);
    const existingReview = await reviewRepo.findOne({
      where: {
        userId: order.userId,
        bookId,
      },
    });

    if (existingReview) {
      existingReview.rating = rating;
      existingReview.comment = comment;
      const savedReview = await reviewRepo.save(existingReview);
      return {
        review: savedReview,
        bookRating: await this.calculateBookRating(bookId),
      };
    }

    const review = reviewRepo.create({
      userId: order.userId,
      bookId,
      rating,
      comment,
    });

    const savedReview = await reviewRepo.save(review);
    return {
      review: savedReview,
      bookRating: await this.calculateBookRating(bookId),
    };
  }

  private async calculateBookRating(bookId: string): Promise<{ bookId: string; rating: number; totalReviews: number }> {
    const stat = await AppDataSource.getRepository(Review)
      .createQueryBuilder('review')
      .select('COUNT(review.id)', 'totalReviews')
      .addSelect('COALESCE(AVG(review.rating), 0)', 'rating')
      .where('review.bookId = :bookId', { bookId })
      .getRawOne<{ totalReviews: string; rating: string }>();

    return {
      bookId,
      totalReviews: Number(stat?.totalReviews || 0),
      rating: Number(Number(stat?.rating || 0).toFixed(1)),
    };
  }

  /**
   * POST /orders
   * Checkout toàn bộ Cart hiện tại → tạo Order.
   * Toàn bộ write-operations chạy trong 1 Transaction.
   */
  async createOrder(userId: string, dto: CreateOrderDto): Promise<Order> {
    const checkoutUser = await AppDataSource.getRepository(User).findOne({ where: { id: userId } });

    if (dto.guestItems && dto.guestItems.length > 0) {
      return this.createDirectUserOrder(userId, dto, checkoutUser?.email);
    }

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
      if (
        !dto.addressLine ||
        !dto.phone ||
        !dto.receiverName ||
        !dto.country ||
        !dto.provinceName ||
        !dto.districtName ||
        !dto.wardName
      ) {
        throw new AppError('Vui lòng cung cấp cả addressId hoặc thông tin địa chỉ đầy đủ (bao gồm: quốc gia, tỉnh/thành, quận/huyện, phường/xã, địa chỉ chi tiết, số điện thoại, người nhận)', 400);
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

      // Sinh mã đơn hàng
      const now = new Date();
      const dd = String(now.getDate()).padStart(2, '0');
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const yy = String(now.getFullYear()).slice(-2);
      const dateStr = `${dd}${mm}${yy}`;
      const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
      const orderCode = `ORD-${dateStr}-${randomStr}`;

      // Tạo Order entity nối với Payment
      const order = manager.create(Order, {
        userId,
        addressId: addressId!,
        orderCode,
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

      // Trừ stock và tăng soldCount của từng Book
      for (const item of itemsData) {
        await manager.decrement(Book, { id: item.bookId }, 'stock', item.quantity);
        await manager.increment(Book, { id: item.bookId }, 'soldCount', item.quantity);
      }

      // Xoá các CartItems đã thanh toán
      for (const cartItem of txOrderItems) {
        await manager.delete(CartItem, { id: cartItem.id });
      }

      return createdOrder;
    });

    // 8. Reload Order kèm relations để trả về cho client
    const result = await this.orderRepository.findByIdAndUserId(savedOrder.id, userId);
    await this.sendOrderConfirmationEmail(result!, dto.email || checkoutUser?.email);
    return result!;
  }

  private async createDirectUserOrder(userId: string, dto: CreateOrderDto, fallbackEmail?: string): Promise<Order> {
    const addressRepo = AppDataSource.getRepository(Address);
    let addressId = dto.addressId;

    if (addressId) {
      const address = await addressRepo.findOne({ where: { id: addressId, userId } });
      if (!address) {
        throw new NotFoundError('Địa chỉ không tồn tại hoặc không thuộc về bạn');
      }
    } else {
      if (!dto.addressLine || !dto.phone || !dto.receiverName || !dto.country || !dto.provinceName || !dto.districtName || !dto.wardName) {
        throw new AppError('Vui lòng cung cấp đầy đủ thông tin giao hàng', 400);
      }

      const address = addressRepo.create({
        userId,
        receiverName: dto.receiverName,
        phone: dto.phone,
        addressLine: dto.addressLine,
        country: dto.country ?? 'Việt Nam',
        provinceCode: dto.provinceCode,
        provinceName: dto.provinceName,
        districtCode: dto.districtCode,
        districtName: dto.districtName,
        wardCode: dto.wardCode,
        wardName: dto.wardName,
      });
      addressId = (await addressRepo.save(address)).id;
    }

    const savedOrder = await AppDataSource.transaction(async (manager: EntityManager) => {
      const itemsData: Array<{ bookId: string; quantity: number; price: number; subTotal: number }> = [];

      for (const item of dto.guestItems!) {
        const lockedBook = await manager.findOne(Book, {
          where: { id: item.bookId },
          lock: { mode: 'pessimistic_write' },
        });

        if (!lockedBook) throw new NotFoundError('Sách không còn tồn tại');

        if (lockedBook.stock < item.quantity) {
          throw new AppError(`Sách "${lockedBook.title}" chỉ còn ${lockedBook.stock} cuốn trong kho (bạn đang chọn ${item.quantity})`, 400);
        }

        const price = Number(lockedBook.price);
        itemsData.push({
          bookId: lockedBook.id,
          quantity: item.quantity,
          price,
          subTotal: item.quantity * price,
        });
      }

      const shippingFee = dto.shippingFee ?? 0;
      const totalAmount = itemsData.reduce((sum, item) => sum + item.subTotal, 0) + shippingFee;
      const now = new Date();
      const dd = String(now.getDate()).padStart(2, '0');
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const yy = String(now.getFullYear()).slice(-2);
      const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();

      const createdOrder = await manager.save(Order, manager.create(Order, {
        userId,
        addressId: addressId!,
        orderCode: `ORD-${dd}${mm}${yy}-${randomStr}`,
        totalAmount,
        shippingFee,
        note: dto.note ?? null,
        status: OrderStatus.PENDING,
      }));

      await manager.save(Payment, manager.create(Payment, {
        orderId: createdOrder.id,
        amount: totalAmount,
        method: dto.paymentMethod ?? PaymentMethod.COD,
        status: PaymentStatus.PENDING,
      }));

      await manager.save(OrderItem, itemsData.map((item) => manager.create(OrderItem, {
        orderId: createdOrder.id,
        bookId: item.bookId,
        quantity: item.quantity,
        price: item.price,
        subTotal: item.subTotal,
      })));

      for (const item of itemsData) {
        await manager.decrement(Book, { id: item.bookId }, 'stock', item.quantity);
        await manager.increment(Book, { id: item.bookId }, 'soldCount', item.quantity);
      }

      return createdOrder;
    });

    const result = await this.orderRepository.findByIdAndUserId(savedOrder.id, userId);
    await this.sendOrderConfirmationEmail(result!, dto.email || fallbackEmail);
    return result!;
  }

  async createGuestOrder(dto: CreateOrderDto): Promise<Order> {
    if (!dto.guestItems || dto.guestItems.length === 0) {
      throw new AppError('Vui lòng chọn ít nhất một sản phẩm để thanh toán', 400);
    }

    if (
      !dto.addressLine ||
      !dto.phone ||
      !dto.receiverName ||
      !dto.country ||
      !dto.provinceName ||
      !dto.districtName ||
      !dto.wardName
    ) {
      throw new AppError('Vui lòng cung cấp đầy đủ thông tin giao hàng', 400);
    }

    const savedOrder = await AppDataSource.transaction(async (manager: EntityManager) => {
      const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const guestUser = manager.create(User, {
        userName: `guest_${suffix}`,
        fullName: dto.receiverName,
        email: `guest-${suffix}@guest.local`,
        passwordHash: '',
        role: Role.GUEST,
        isVerified: false,
        isLocked: false,
      });
      const savedGuest = await manager.save(User, guestUser);

      const address = manager.create(Address, {
        userId: savedGuest.id,
        receiverName: dto.receiverName,
        phone: dto.phone,
        addressLine: dto.addressLine,
        country: dto.country ?? 'Việt Nam',
        provinceCode: dto.provinceCode,
        provinceName: dto.provinceName,
        districtCode: dto.districtCode,
        districtName: dto.districtName,
        wardCode: dto.wardCode,
        wardName: dto.wardName,
        isDefault: true,
      });
      const savedAddress = await manager.save(Address, address);

      const itemsData: Array<{ bookId: string; quantity: number; price: number; subTotal: number }> = [];
      for (const item of dto.guestItems!) {
        const lockedBook = await manager.findOne(Book, {
          where: { id: item.bookId },
          lock: { mode: 'pessimistic_write' },
        });

        if (!lockedBook) {
          throw new NotFoundError('Sách trong giỏ hàng không còn tồn tại');
        }

        if (lockedBook.stock < item.quantity) {
          throw new AppError(
            `Sách "${lockedBook.title}" chỉ còn ${lockedBook.stock} cuốn trong kho (bạn đang chọn ${item.quantity})`,
            400
          );
        }

        const price = Number(lockedBook.price);
        itemsData.push({
          bookId: lockedBook.id,
          quantity: item.quantity,
          price,
          subTotal: item.quantity * price,
        });
      }

      const shippingFee = dto.shippingFee ?? 0;
      const totalAmount = itemsData.reduce((sum, item) => sum + item.subTotal, 0) + shippingFee;
      const now = new Date();
      const dd = String(now.getDate()).padStart(2, '0');
      const mm = String(now.getMonth() + 1).padStart(2, '0');
      const yy = String(now.getFullYear()).slice(-2);
      const randomStr = Math.random().toString(36).substring(2, 6).toUpperCase();
      const orderCode = `ORD-${dd}${mm}${yy}-${randomStr}`;

      const order = manager.create(Order, {
        userId: savedGuest.id,
        addressId: savedAddress.id,
        orderCode,
        totalAmount,
        shippingFee,
        note: dto.note ?? null,
        status: OrderStatus.PENDING,
      });
      const createdOrder = await manager.save(Order, order);

      const payment = manager.create(Payment, {
        orderId: createdOrder.id,
        amount: totalAmount,
        method: dto.paymentMethod ?? PaymentMethod.COD,
        status: PaymentStatus.PENDING,
      });
      await manager.save(Payment, payment);

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

      for (const item of itemsData) {
        await manager.decrement(Book, { id: item.bookId }, 'stock', item.quantity);
        await manager.increment(Book, { id: item.bookId }, 'soldCount', item.quantity);
      }

      return createdOrder;
    });

    const result = await this.orderRepository.findById(savedOrder.id);
    await this.sendOrderConfirmationEmail(result!, dto.email);
    return result!;
  }

  private async sendOrderConfirmationEmail(order: Order, email?: string): Promise<void> {
    if (!email) return;
    return this.sendDetailedOrderConfirmationEmail(order, email);

    const orderCode = order.orderCode || order.id;
    const phone = order.address?.phone || '';
    const receiverName = order.address?.receiverName || 'khách hàng';
    const totalAmount = Number(order.totalAmount || 0).toLocaleString('vi-VN');
    const itemsHtml = (order.items || [])
      .map((item) => {
        const title = this.escapeHtml(item.book?.title || 'Sách');
        const quantity = Number(item.quantity || 0);
        const subTotal = Number(item.subTotal || 0).toLocaleString('vi-VN');
        return `<li>${title} x ${quantity}: ${subTotal}đ</li>`;
      })
      .join('');

    const text = [
      `Xin chào ${receiverName},`,
      `Đơn hàng ${orderCode} đã được tạo thành công.`,
      `Tổng thanh toán: ${totalAmount}đ.`,
      `Tra cứu đơn hàng bằng mã đơn ${orderCode} và số điện thoại ${phone}.`,
    ].join('\n');

    const html = `
      <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6;">
        <h2 style="color: #ea580c;">Đặt hàng thành công</h2>
        <p>Xin chào <strong>${this.escapeHtml(receiverName)}</strong>,</p>
        <p>Đơn hàng <strong>${this.escapeHtml(orderCode)}</strong> đã được tạo thành công.</p>
        <p><strong>Tổng thanh toán:</strong> ${totalAmount}đ</p>
        ${itemsHtml ? `<p><strong>Sản phẩm:</strong></p><ul>${itemsHtml}</ul>` : ''}
        <div style="padding: 12px 16px; background: #eff6ff; border-radius: 8px;">
          <p style="margin: 0;"><strong>Hướng dẫn tra cứu đơn hàng</strong></p>
          <p style="margin: 8px 0 0;">Vào trang Tra cứu đơn hàng, nhập mã đơn <strong>${this.escapeHtml(orderCode)}</strong> và số điện thoại <strong>${this.escapeHtml(phone)}</strong>.</p>
        </div>
      </div>
    `;

    await emailQueue.add('sendOrderConfirmation', {
      to: email,
      subject: `Xác nhận đơn hàng ${orderCode}`,
      text,
      html,
    });
  }

  private async sendDetailedOrderConfirmationEmail(order: Order, email: string): Promise<void> {
    const orderCode = order.orderCode || order.id;
    const phone = order.address?.phone || '';
    const receiverName = order.address?.receiverName || 'khách hàng';
    const shippingFee = Number(order.shippingFee || 0);
    const totalAmount = Number(order.totalAmount || 0);
    const subtotal = Math.max(totalAmount - shippingFee, 0);
    const paymentMethod = order.payments?.[0]?.method || PaymentMethod.COD;
    const paymentStatus = order.payments?.[0]?.status || PaymentStatus.PENDING;
    const addressParts = [
      order.address?.addressLine,
      order.address?.wardName,
      order.address?.districtName,
      order.address?.provinceName,
      order.address?.country,
    ].filter(Boolean);
    const shippingAddress = addressParts.join(', ');
    const money = (value: number) => `${value.toLocaleString('vi-VN')}đ`;
    const orderDate = order.createdAt
      ? new Date(order.createdAt).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' })
      : new Date().toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' });
    const statusLabel = this.getOrderStatusLabel(order.status);
    const paymentMethodLabel = this.getPaymentMethodLabel(paymentMethod);
    const paymentStatusLabel = this.getPaymentStatusLabel(paymentStatus);

    const itemsHtml = (order.items || [])
      .map((item) => {
        const title = this.escapeHtml(item.book?.title || 'Sách');
        const quantity = Number(item.quantity || 0);
        const price = Number(item.price || 0);
        const itemSubtotal = Number(item.subTotal || 0);
        return `
          <tr>
            <td style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb;">${title}</td>
            <td style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; text-align: center;">${quantity}</td>
            <td style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; text-align: right;">${money(price)}</td>
            <td style="padding: 10px 8px; border-bottom: 1px solid #e5e7eb; text-align: right;"><strong>${money(itemSubtotal)}</strong></td>
          </tr>
        `;
      })
      .join('');
    const itemsText = (order.items || [])
      .map((item) => {
        const title = item.book?.title || 'Sách';
        return `- ${title} x ${Number(item.quantity || 0)}: ${money(Number(item.subTotal || 0))}`;
      })
      .join('\n');

    const text = [
      `Xin chào ${receiverName},`,
      `Đơn hàng ${orderCode} đã được tạo thành công.`,
      `Ngày đặt: ${orderDate}`,
      `Trạng thái: ${statusLabel}`,
      `Người nhận: ${receiverName}`,
      `Số điện thoại: ${phone}`,
      `Địa chỉ giao hàng: ${shippingAddress}`,
      `Phương thức thanh toán: ${paymentMethodLabel}`,
      `Trạng thái thanh toán: ${paymentStatusLabel}`,
      '',
      'Sản phẩm:',
      itemsText || '- Không có sản phẩm',
      '',
      `Tạm tính: ${money(subtotal)}`,
      `Phí vận chuyển: ${money(shippingFee)}`,
      `Tổng thanh toán: ${money(totalAmount)}`,
      order.note ? `Ghi chú: ${order.note}` : '',
      '',
      `Tra cứu đơn hàng bằng mã đơn ${orderCode} và số điện thoại ${phone}.`,
    ].filter((line) => line !== '').join('\n');

    const html = `
      <div style="font-family: Arial, sans-serif; color: #1f2937; line-height: 1.6; max-width: 720px; margin: 0 auto;">
        <h2 style="color: #ea580c; margin-bottom: 8px;">Đặt hàng thành công</h2>
        <p>Xin chào <strong>${this.escapeHtml(receiverName)}</strong>,</p>
        <p>Đơn hàng <strong>${this.escapeHtml(orderCode)}</strong> đã được tạo thành công. Dưới đây là toàn bộ thông tin đơn hàng của bạn.</p>

        <div style="padding: 16px; background: #fff7ed; border: 1px solid #fed7aa; border-radius: 10px; margin: 18px 0;">
          <p style="margin: 0 0 6px;"><strong>Mã đơn hàng:</strong> ${this.escapeHtml(orderCode)}</p>
          <p style="margin: 0 0 6px;"><strong>Ngày đặt:</strong> ${this.escapeHtml(orderDate)}</p>
          <p style="margin: 0;"><strong>Trạng thái:</strong> ${this.escapeHtml(statusLabel)}</p>
        </div>

        <h3 style="margin: 18px 0 8px;">Thông tin giao hàng</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 6px 0; color: #6b7280;">Người nhận</td><td style="padding: 6px 0; text-align: right;"><strong>${this.escapeHtml(receiverName)}</strong></td></tr>
          <tr><td style="padding: 6px 0; color: #6b7280;">Số điện thoại</td><td style="padding: 6px 0; text-align: right;"><strong>${this.escapeHtml(phone)}</strong></td></tr>
          <tr><td style="padding: 6px 0; color: #6b7280;">Địa chỉ</td><td style="padding: 6px 0; text-align: right;">${this.escapeHtml(shippingAddress)}</td></tr>
        </table>

        <h3 style="margin: 18px 0 8px;">Thanh toán</h3>
        <table style="width: 100%; border-collapse: collapse;">
          <tr><td style="padding: 6px 0; color: #6b7280;">Phương thức</td><td style="padding: 6px 0; text-align: right;">${this.escapeHtml(paymentMethodLabel)}</td></tr>
          <tr><td style="padding: 6px 0; color: #6b7280;">Trạng thái</td><td style="padding: 6px 0; text-align: right;">${this.escapeHtml(paymentStatusLabel)}</td></tr>
        </table>

        <h3 style="margin: 18px 0 8px;">Sản phẩm</h3>
        <table style="width: 100%; border-collapse: collapse; border-top: 1px solid #e5e7eb;">
          <thead>
            <tr>
              <th style="padding: 8px; text-align: left; color: #6b7280;">Sách</th>
              <th style="padding: 8px; text-align: center; color: #6b7280;">SL</th>
              <th style="padding: 8px; text-align: right; color: #6b7280;">Đơn giá</th>
              <th style="padding: 8px; text-align: right; color: #6b7280;">Thành tiền</th>
            </tr>
          </thead>
          <tbody>${itemsHtml}</tbody>
        </table>

        <div style="margin-top: 16px; padding: 16px; background: #f9fafb; border-radius: 10px;">
          <p style="margin: 0 0 6px; text-align: right;">Tạm tính: <strong>${money(subtotal)}</strong></p>
          <p style="margin: 0 0 6px; text-align: right;">Phí vận chuyển: <strong>${money(shippingFee)}</strong></p>
          <p style="margin: 0; text-align: right; font-size: 18px;">Tổng thanh toán: <strong style="color: #ea580c;">${money(totalAmount)}</strong></p>
        </div>

        ${order.note ? `<p style="margin-top: 16px;"><strong>Ghi chú:</strong> ${this.escapeHtml(order.note)}</p>` : ''}

        <div style="padding: 14px 16px; background: #eff6ff; border-radius: 10px; margin-top: 18px;">
          <p style="margin: 0;"><strong>Hướng dẫn tra cứu đơn hàng</strong></p>
          <p style="margin: 8px 0 0;">Vào trang Tra cứu đơn hàng, nhập mã đơn <strong>${this.escapeHtml(orderCode)}</strong> và số điện thoại <strong>${this.escapeHtml(phone)}</strong>.</p>
        </div>
      </div>
    `;

    await emailQueue.add('sendOrderConfirmation', {
      to: email,
      subject: `Xác nhận đơn hàng ${orderCode}`,
      text,
      html,
    });
  }

  private getOrderStatusLabel(status: OrderStatus): string {
    const labels: Record<OrderStatus, string> = {
      [OrderStatus.PENDING]: 'Chờ xử lý',
      [OrderStatus.PROCESSING]: 'Đang xử lý',
      [OrderStatus.SHIPPED]: 'Đang giao hàng',
      [OrderStatus.COMPLETED]: 'Hoàn tất',
      [OrderStatus.CANCELLED]: 'Đã hủy',
    };
    return labels[status] || status;
  }

  private getPaymentMethodLabel(method: PaymentMethod): string {
    const labels: Record<PaymentMethod, string> = {
      [PaymentMethod.CREDIT_CARD]: 'Thẻ tín dụng',
      [PaymentMethod.DEBIT_CARD]: 'Thẻ ghi nợ',
      [PaymentMethod.BANK_TRANSFER]: 'Chuyển khoản ngân hàng',
      [PaymentMethod.WALLET]: 'Ví điện tử',
      [PaymentMethod.COD]: 'Thanh toán khi nhận hàng (COD)',
    };
    return labels[method] || method;
  }

  private getPaymentStatusLabel(status: PaymentStatus): string {
    const labels: Record<PaymentStatus, string> = {
      [PaymentStatus.PENDING]: 'Chờ thanh toán',
      [PaymentStatus.COMPLETED]: 'Đã thanh toán',
      [PaymentStatus.FAILED]: 'Thanh toán thất bại',
      [PaymentStatus.REFUNDED]: 'Đã hoàn tiền',
    };
    return labels[status] || status;
  }

  private escapeHtml(value: string): string {
    return value
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  async trackOrder(orderCode: string): Promise<Order> {
    const order = await this.orderRepository.findByOrderCode(orderCode);
    if (!order) {
      throw new NotFoundError('Không tìm thấy đơn hàng phù hợp');
    }

    return order;
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
