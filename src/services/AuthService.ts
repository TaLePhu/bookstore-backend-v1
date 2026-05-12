import { injectable, inject } from 'tsyringe';
import { AppDataSource } from '@config/data-source';
import { randomInt } from 'crypto';
import { v4 as uuidv4 } from 'uuid';
import { RegisterDto } from '@dtos/auth/RegisterDto';
import { LoginDto } from '@dtos/auth/LoginDto';
import { VerifyEmailDto } from '@dtos/auth/VerifyEmailDto';
import { IUserRepository } from '@repositories/interfaces/IUserRepository';
import { IRefreshTokenRepository } from '@repositories/interfaces/IRefreshTokenRepository';
import { TOKENS } from '@config/container';
import { HashHelper } from '@utils/hash';
import { TokenHelper, TokenPayload } from '@utils/jwt';
import { ConflictError, UnauthorizedError, ForbiddenError, NotFoundError } from '@utils/errors';
import { Role } from '@entities/User';
import { UserAdvance } from '@entities/UserAdvance';
import { RefreshToken } from '@entities/RefreshToken';
import redisConfig from '@config/redis';
import { emailQueue } from '@config/queue';

export interface AuthResponse {
  id: string;
  email: string;
  userName: string;
  fullName?: string;
  phone?: string;
  role: Role;
  accessToken: string;
  refreshToken: string;
  deviceId: string;
}

@injectable()
export class AuthService {
  private static readonly VERIFY_CODE_TTL_SECONDS = 15 * 60;
  private static readonly VERIFY_MAX_ATTEMPTS = 5;

  constructor(
    @inject(TOKENS.USER_REPOSITORY) private userRepository: IUserRepository,
    @inject(TOKENS.REFRESH_TOKEN_REPOSITORY) private refreshTokenRepository: IRefreshTokenRepository
  ) {}

  async checkEmailExists(email: string): Promise<{ exists: boolean }> {
    const user = await this.userRepository.findByEmail(email.trim().toLowerCase());
    return { exists: !!user };
  }

  async register(data: RegisterDto): Promise<{ message: string }> {
    const passwordHash = await HashHelper.hash(data.password);

    // Check if user already exists
    const existingUser = await this.userRepository.findByEmail(data.email);
    if (existingUser) {
      throw new ConflictError('Email already registered');
    }

    // Create user
    const user = await this.userRepository.create({
      email: data.email,
      userName: data.userName,
      fullName: data.fullName || data.userName,
      passwordHash,
      role: Role.CUSTOMER,
      isVerified: false,
    } as any);

    if (data.phone) {
      const userAdvanceRepository = AppDataSource.getRepository(UserAdvance);
      const userAdvance = userAdvanceRepository.create({
        userId: user.id,
        phone: data.phone,
      } as any);
      await userAdvanceRepository.save(userAdvance);
    }

    await this.sendVerificationCode(data.email);

    return {
      message: 'Đăng ký thành công. Vui lòng kiểm tra email để nhận mã xác thực.',
    };
  }

  async resendVerificationCode(data: { email: string }): Promise<{ message: string }> {
    const user = await this.userRepository.findByEmail(data.email);
    if (!user) {
      throw new NotFoundError('Không tìm thấy tài khoản với email này');
    }

    if (user.isVerified) {
      throw new ConflictError('Tài khoản đã được xác thực, không cần gửi lại mã');
    }

    await this.sendVerificationCode(data.email);

    return {
      message: 'Đã gửi lại mã xác thực mới. Vui lòng kiểm tra email.',
    };
  }

  async verifyEmail(data: VerifyEmailDto): Promise<AuthResponse> {
    const { email, code } = data;
    const attemptsKey = `verify_attempts:${email}`;
    const storedCode = await redisConfig.get(`verify_code:${email}`);

    if (!storedCode) {
      throw new UnauthorizedError('Mã xác thực không hợp lệ hoặc đã hết hạn');
    }

    if (storedCode !== code) {
      const attempts = await redisConfig.incr(attemptsKey);
      if (attempts === 1) {
        await redisConfig.expire(attemptsKey, AuthService.VERIFY_CODE_TTL_SECONDS);
      }

      if (attempts >= AuthService.VERIFY_MAX_ATTEMPTS) {
        await redisConfig.del(`verify_code:${email}`);
        await redisConfig.del(attemptsKey);
        throw new UnauthorizedError('Bạn đã nhập sai mã xác thực quá số lần cho phép. Vui lòng dùng chức năng gửi lại mã để nhận mã mới.');
      }

      throw new UnauthorizedError('Mã xác thực không hợp lệ hoặc đã hết hạn');
    }
    
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new UnauthorizedError('Không tìm thấy user');
    }
    
    // Update user
    await this.userRepository.update(user.id, { isVerified: true } as any);
    const verifiedUser = await this.userRepository.findById(user.id, ['userAdvance']);
    if (!verifiedUser) {
      throw new UnauthorizedError('KhĂ´ng tĂ¬m tháº¥y user');
    }
    
    // Remove code from redis
    await redisConfig.del(`verify_code:${email}`);
    await redisConfig.del(attemptsKey);
    
    const deviceId = uuidv4();

    const { accessToken, refreshTokenValue, refreshPayload } = this.generateTokenPair({
      userId: verifiedUser.id,
      deviceId,
      email: verifiedUser.email,
      role: verifiedUser.role,
    });

    await this.storeSession(verifiedUser.id, deviceId, refreshTokenValue, refreshPayload);

    return {
      id: verifiedUser.id,
      userName: verifiedUser.userName,
      fullName: verifiedUser.fullName,
      email: verifiedUser.email,
      phone: verifiedUser.userAdvance?.phone,
      role: verifiedUser.role,
      accessToken,
      refreshToken: refreshTokenValue,
      deviceId,
    };
  }

  async login(data: LoginDto): Promise<AuthResponse> {
    // Find user by email
    const user = await this.userRepository.findByEmail(data.email);
    if (!user) {
      throw new UnauthorizedError('Email hoặc mật khẩu không đúng');
    }

    if (!user.isVerified) {
      throw new UnauthorizedError('Vui lòng xác thực email trước khi đăng nhập');
    }

    if (user.isLocked) {
      throw new ForbiddenError('Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Admin.');
    }

    // Verify password
    const isPasswordValid = await HashHelper.compare(data.password, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedError('Email hoặc mật khẩu không đúng');
    }

    const deviceId = uuidv4();

    const { accessToken, refreshTokenValue, refreshPayload } = this.generateTokenPair({
      userId: user.id,
      deviceId,
      email: user.email,
      role: user.role,
    });

    await this.storeSession(user.id, deviceId, refreshTokenValue, refreshPayload);

    return {
      id: user.id,
      userName: user.userName,
      fullName: user.fullName,
      email: user.email,
      phone: user.userAdvance?.phone,
      role: user.role,
      accessToken,
      refreshToken: refreshTokenValue,
      deviceId,
    };
  }

  async refreshToken(token: string, deviceId: string): Promise<AuthResponse> {
    if (!deviceId) {
      throw new UnauthorizedError('Missing deviceId');
    }

    let refreshPayload: TokenPayload;
    try {
      refreshPayload = TokenHelper.verifyRefreshToken(token);
    } catch {
      throw new UnauthorizedError('Invalid refresh token');
    }

    if (refreshPayload.deviceId !== deviceId) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    const refreshTokenHash = HashHelper.sha256(token);
    const sessionKey = this.buildSessionKey(refreshPayload.userId, deviceId);
    const redisSession = await this.getSessionFromRedis(sessionKey);

    if (redisSession && redisSession.refreshTokenHash !== refreshTokenHash) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    let refreshTokenRecord: RefreshToken | null = null;
    if (!redisSession) {
      refreshTokenRecord = await this.refreshTokenRepository.findActiveByTokenHashAndDeviceId(refreshTokenHash, deviceId);
      if (!refreshTokenRecord) {
        throw new UnauthorizedError('Invalid refresh token');
      }
    }

    const user = await this.userRepository.findById(refreshPayload.userId, ['userAdvance']);
    if (!user) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    if (user.isLocked) {
      throw new ForbiddenError('Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Admin.');
    }

    if (refreshTokenRecord) {
      await this.refreshTokenRepository.revoke(refreshTokenRecord.id);
    } else {
      await this.refreshTokenRepository.revokeByUserIdAndDeviceId(refreshPayload.userId, deviceId);
    }

    const { accessToken, refreshTokenValue, refreshPayload: newRefreshPayload } = this.generateTokenPair({
      userId: user.id,
      deviceId,
      email: user.email,
      role: user.role,
    });

    await this.storeSession(user.id, deviceId, refreshTokenValue, newRefreshPayload);

    return {
      id: user.id,
      userName: user.userName,
      fullName: user.fullName,
      email: user.email,
      phone: user.userAdvance?.phone,
      role: user.role,
      accessToken,
      refreshToken: refreshTokenValue,
      deviceId,
    };
  }

  async logout(userId: string, deviceId: string): Promise<void> {
    const sessionKey = this.buildSessionKey(userId, deviceId);
    await redisConfig.del(sessionKey);
    await this.refreshTokenRepository.revokeByUserIdAndDeviceId(userId, deviceId);
  }

  private generateTokenPair(payload: Omit<TokenPayload, 'iat' | 'exp'>): { accessToken: string; refreshTokenValue: string; refreshPayload: TokenPayload } {
    const accessToken = TokenHelper.generateAccessToken(payload);
    const refreshTokenValue = TokenHelper.generateRefreshToken(payload);
    const refreshPayload = TokenHelper.verifyRefreshToken(refreshTokenValue);
    return { accessToken, refreshTokenValue, refreshPayload };
  }

  private buildSessionKey(userId: string, deviceId: string): string {
    return `auth:${userId}:${deviceId}`;
  }

  private async storeSession(userId: string, deviceId: string, refreshToken: string, refreshPayload: TokenPayload): Promise<void> {
    if (!refreshPayload.exp) {
      throw new UnauthorizedError('Invalid refresh token');
    }

    const refreshTokenHash = HashHelper.sha256(refreshToken);
    const expiresAt = new Date(refreshPayload.exp * 1000);
    const ttlSeconds = Math.max(1, Math.floor((expiresAt.getTime() - Date.now()) / 1000));
    const sessionKey = this.buildSessionKey(userId, deviceId);
    const value = JSON.stringify({
      refreshTokenHash,
      expiresAt: expiresAt.toISOString(),
    });

    await redisConfig.set(sessionKey, value, 'EX', ttlSeconds);
    await this.refreshTokenRepository.create({
      userId,
      deviceId,
      token: refreshTokenHash,
      expiresAt,
      isRevoked: false,
    } as any);
  }

  private async getSessionFromRedis(sessionKey: string): Promise<{ refreshTokenHash: string; expiresAt: string } | null> {
    try {
      const raw = await redisConfig.get(sessionKey);
      if (!raw) {
        return null;
      }
      return JSON.parse(raw) as { refreshTokenHash: string; expiresAt: string };
    } catch {
      return null;
    }
  }

  private async sendVerificationCode(email: string): Promise<void> {
    const verificationCode = randomInt(100000, 1000000).toString();

    await redisConfig.setex(
      `verify_code:${email}`,
      AuthService.VERIFY_CODE_TTL_SECONDS,
      verificationCode
    );
    await redisConfig.del(`verify_attempts:${email}`);

    await emailQueue.add('sendVerificationCode', {
      to: email,
      subject: 'Xác thực tài khoản BookStore',
      html: `<h1>Mã xác thực của bạn</h1><p>Mã của bạn là: <strong style="font-size:24px;">${verificationCode}</strong></p><p>Mã này sẽ hết hạn trong 15 phút.</p>`,
    });
  }
}
