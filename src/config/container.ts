import 'reflect-metadata';
import { container } from 'tsyringe';
import { IUserRepository } from '@repositories/interfaces/IUserRepository';
import { IRefreshTokenRepository } from '@repositories/interfaces/IRefreshTokenRepository';
import { UserRepository } from '@repositories/typeorm/UserRepository';
import { RefreshTokenRepository } from '@repositories/typeorm/RefreshTokenRepository';

// Token symbols for DI
export const TOKENS = {
  USER_REPOSITORY: 'IUserRepository',
  REFRESH_TOKEN_REPOSITORY: 'IRefreshTokenRepository',
};

export function setupDependencies(): void {
  // Register repositories
  container.register<IUserRepository>(TOKENS.USER_REPOSITORY, {
    useClass: UserRepository,
  });

  container.register<IRefreshTokenRepository>(TOKENS.REFRESH_TOKEN_REPOSITORY, {
    useClass: RefreshTokenRepository,
  });
}

export function getContainer() {
  return container;
}
