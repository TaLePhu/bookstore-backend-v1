import { Repository } from 'typeorm';
import { AppDataSource } from '@config/data-source';
import { CartItem } from '@entities/CartItem';
import { ICartItemRepository } from '@repositories/interfaces/ICartItemRepository';

export class CartItemRepository implements ICartItemRepository {
  private repository: Repository<CartItem>;

  constructor() {
    this.repository = AppDataSource.getRepository(CartItem);
  }

  async findByCartAndBook(cartId: string, bookId: string): Promise<CartItem | null> {
    return await this.repository.findOne({
      where: {
        cartId,
        bookId,
      },
    });
  }

  async addCartItem(cartId: string, bookId: string, quantity: number): Promise<CartItem> {
    const item = this.repository.create({
      cartId,
      bookId,
      quantity,
    });
    return await this.repository.save(item);
  }

  async updateQuantity(cartItemId: string, newQuantity: number): Promise<CartItem> {
    await this.repository.update(cartItemId, { quantity: newQuantity });
    return await this.repository.findOneOrFail({ where: { id: cartItemId } });
  }

  async removeCartItem(cartItemId: string): Promise<void> {
    await this.repository.delete(cartItemId);
  }

  async findById(cartItemId: string): Promise<CartItem | null> {
    return await this.repository.findOne({
      where: { id: cartItemId },
      relations: ['cart'],
    });
  }
}
