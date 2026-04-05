import 'reflect-metadata';
import { container } from 'tsyringe';
import { IUserRepository } from '@repositories/interfaces/IUserRepository';
import { IRefreshTokenRepository } from '@repositories/interfaces/IRefreshTokenRepository';
import { IBookRepository } from '@repositories/interfaces/IBookRepository';
import { ICategoryRepository } from '@repositories/interfaces/ICategoryRepository';
import { UserRepository } from '@repositories/typeorm/UserRepository';
import { RefreshTokenRepository } from '@repositories/typeorm/RefreshTokenRepository';
import { BookRepository } from '@repositories/typeorm/BookRepository';
import { CategoryRepository } from '@repositories/typeorm/CategoryRepository';

// Token symbols for DI
export const TOKENS = {
  USER_REPOSITORY: 'IUserRepository',
  REFRESH_TOKEN_REPOSITORY: 'IRefreshTokenRepository',
  BOOK_REPOSITORY: 'IBookRepository',
  CATEGORY_REPOSITORY: 'ICategoryRepository',
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
}

export function getContainer() {
  return container;
}
