import 'reflect-metadata';
import { container } from 'tsyringe';
import { IUserRepository } from '@repositories/interfaces/IUserRepository';
import { IRefreshTokenRepository } from '@repositories/interfaces/IRefreshTokenRepository';
import { IBookRepository } from '@repositories/interfaces/IBookRepository';
import { ICategoryRepository } from '@repositories/interfaces/ICategoryRepository';
import { ICartRepository } from '@repositories/interfaces/ICartRepository';
import { ICartItemRepository } from '@repositories/interfaces/ICartItemRepository';
import { IOrderRepository } from '@repositories/interfaces/IOrderRepository';
import { UserRepository } from '@repositories/typeorm/UserRepository';
import { RefreshTokenRepository } from '@repositories/typeorm/RefreshTokenRepository';
import { BookRepository } from '@repositories/typeorm/BookRepository';
import { CategoryRepository } from '@repositories/typeorm/CategoryRepository';
import { CartRepository } from '@repositories/typeorm/CartRepository';
import { CartItemRepository } from '@repositories/typeorm/CartItemRepository';
import { OrderRepository } from '@repositories/typeorm/OrderRepository';

// Token symbols for DI
export const TOKENS = {
  USER_REPOSITORY: 'IUserRepository',
  REFRESH_TOKEN_REPOSITORY: 'IRefreshTokenRepository',
  BOOK_REPOSITORY: 'IBookRepository',
  CATEGORY_REPOSITORY: 'ICategoryRepository',
  CART_REPOSITORY: 'ICartRepository',
  CART_ITEM_REPOSITORY: 'ICartItemRepository',
  ORDER_REPOSITORY: 'IOrderRepository',
};

export function setupDependencies(): void {
  // Register repositories
  container.register<IUserRepository>(TOKENS.USER_REPOSITORY, {
    useClass: UserRepository,
  });

  container.register<IRefreshTokenRepository>(TOKENS.REFRESH_TOKEN_REPOSITORY, {
    useClass: RefreshTokenRepository,
  });

  container.register<IBookRepository>(TOKENS.BOOK_REPOSITORY, {
    useClass: BookRepository,
  });

  container.register<ICategoryRepository>(TOKENS.CATEGORY_REPOSITORY, {
    useClass: CategoryRepository,
  });

  container.register<ICartRepository>(TOKENS.CART_REPOSITORY, {
    useClass: CartRepository,
  });

  container.register<ICartItemRepository>(TOKENS.CART_ITEM_REPOSITORY, {
    useClass: CartItemRepository,
  });

  container.register<IOrderRepository>(TOKENS.ORDER_REPOSITORY, {
    useClass: OrderRepository,
  });
}

export function getContainer() {
  return container;
}
