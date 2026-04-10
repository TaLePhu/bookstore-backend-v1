import { Repository } from 'typeorm';
import { AppDataSource } from '@config/data-source';
import { Cart } from '@entities/Cart';
import { ICartRepository } from '@repositories/interfaces/ICartRepository';

export class CartRepository implements ICartRepository {
  private repository: Repository<Cart>;

  constructor() {
    this.repository = AppDataSource.getRepository(Cart);
  }

  async findActiveByUserId(userId: string): Promise<Cart | null> {
    return await this.repository.findOne({
      where: { userId },
      relations: ['items', 'items.book'],
      order: {
        createdAt: 'DESC', // Lấy giỏ hàng mới nhất
        items: {
          createdAt: 'ASC', // Sắp xếp item theo thứ tự thêm vào
        }
      },
    });
  }

  async createCart(userId: string): Promise<Cart> {
    const cart = this.repository.create({ userId });
    return await this.repository.save(cart);
  }
}
