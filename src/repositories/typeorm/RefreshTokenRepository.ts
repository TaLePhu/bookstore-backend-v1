import { Repository, LessThan, MoreThan } from 'typeorm';
import { RefreshToken } from '@entities/RefreshToken';
import { AppDataSource } from '@config/data-source';
import { IRefreshTokenRepository } from '@repositories/interfaces/IRefreshTokenRepository';

export class RefreshTokenRepository implements IRefreshTokenRepository {
  private repository: Repository<RefreshToken>;

  constructor() {
    this.repository = AppDataSource.getRepository(RefreshToken);
  }

  async create(tokenData: Partial<RefreshToken>): Promise<RefreshToken> {
    const token = this.repository.create(tokenData);
    return this.repository.save(token);
  }

  async findById(id: string): Promise<RefreshToken | null> {
    return this.repository.findOne({
      where: { id },
    });
  }

  async findByTokenHash(tokenHash: string): Promise<RefreshToken | null> {
    return this.repository.findOne({
      where: { token: tokenHash },
      relations: ['user'],
    });
  }

  async findActiveByUserId(userId: string): Promise<RefreshToken[]> {
    const now = new Date();
    return this.repository.find({
      where: {
        userId,
        isRevoked: false,
        expiresAt: MoreThan(now),
      },
      order: { createdAt: 'DESC' },
    });
  }

  async findActiveByUserIdAndDeviceId(userId: string, deviceId: string): Promise<RefreshToken | null> {
    const now = new Date();
    return this.repository.findOne({
      where: {
        userId,
        deviceId,
        isRevoked: false,
        expiresAt: MoreThan(now),
      },
      order: { createdAt: 'DESC' },
      relations: ['user'],
    });
  }

  async findActiveByTokenHashAndDeviceId(tokenHash: string, deviceId: string): Promise<RefreshToken | null> {
    const now = new Date();
    return this.repository.findOne({
      where: {
        token: tokenHash,
        deviceId,
        isRevoked: false,
        expiresAt: MoreThan(now),
      },
      relations: ['user'],
    });
  }

  async revoke(id: string): Promise<boolean> {
    const token = await this.findById(id);
    if (!token) return false;
    token.isRevoked = true;
    await this.repository.save(token);
    return true;
  }

  async revokeAllByUserId(userId: string): Promise<boolean> {
    const result = await this.repository.update(
      { userId, isRevoked: false },
      { isRevoked: true }
    );
    return (result.affected ?? 0) > 0;
  }

  async revokeByUserIdAndDeviceId(userId: string, deviceId: string): Promise<boolean> {
    const result = await this.repository.update(
      { userId, deviceId, isRevoked: false },
      { isRevoked: true }
    );
    return (result.affected ?? 0) > 0;
  }

  async deleteExpired(): Promise<number> {
    const now = new Date();
    const result = await this.repository.delete({
      expiresAt: LessThan(now),
    });
    return result.affected ?? 0;
  }
}
