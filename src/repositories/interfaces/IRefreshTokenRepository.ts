import { RefreshToken } from '@entities/RefreshToken';

export interface IRefreshTokenRepository {
  create(token: Partial<RefreshToken>): Promise<RefreshToken>;
  findById(id: string): Promise<RefreshToken | null>;
  findByTokenHash(tokenHash: string): Promise<RefreshToken | null>;
  findActiveByUserId(userId: string): Promise<RefreshToken[]>;
  findActiveByUserIdAndDeviceId(userId: string, deviceId: string): Promise<RefreshToken | null>;
  findActiveByTokenHashAndDeviceId(tokenHash: string, deviceId: string): Promise<RefreshToken | null>;
  revoke(id: string): Promise<boolean>;
  revokeAllByUserId(userId: string): Promise<boolean>;
  revokeByUserIdAndDeviceId(userId: string, deviceId: string): Promise<boolean>;
  deleteExpired(): Promise<number>;
}
