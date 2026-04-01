import { RefreshToken } from '@entities/RefreshToken';

export interface IRefreshTokenRepository {
  create(token: Partial<RefreshToken>): Promise<RefreshToken>;
  findById(id: string): Promise<RefreshToken | null>;
  findByToken(token: string): Promise<RefreshToken | null>;
  findActiveByUserId(userId: string): Promise<RefreshToken[]>;
  revoke(id: string): Promise<boolean>;
  revokeAllByUserId(userId: string): Promise<boolean>;
  deleteExpired(): Promise<number>;
}
