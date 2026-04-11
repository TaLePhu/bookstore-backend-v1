import { Repository } from 'typeorm';
import { AppDataSource } from '@config/data-source';
import { Order } from '@entities/Order';
import { IOrderRepository } from '@repositories/interfaces/IOrderRepository';

export class OrderRepository implements IOrderRepository {
  private repository: Repository<Order>;

  constructor() {
    this.repository = AppDataSource.getRepository(Order);
  }

  async findByUserId(
    userId: string,
    page: number,
    limit: number
  ): Promise<{ orders: Order[]; total: number }> {
    const skip = (page - 1) * limit;

    const [orders, total] = await this.repository.findAndCount({
      where: { userId },
      relations: ['items', 'items.book', 'address'],
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return { orders, total };
  }

  async findByIdAndUserId(orderId: string, userId: string): Promise<Order | null> {
    return await this.repository.findOne({
      where: { id: orderId, userId },
      relations: ['items', 'items.book', 'address'],
    });
  }
}
