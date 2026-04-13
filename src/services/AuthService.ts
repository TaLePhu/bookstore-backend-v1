import { injectable, inject } from 'tsyringe';
import { RegisterDto } from '@dtos/auth/RegisterDto';
import { LoginDto } from '@dtos/auth/LoginDto';
import { VerifyEmailDto } from '@dtos/auth/VerifyEmailDto';
import { IUserRepository } from '@repositories/interfaces/IUserRepository';
import { IRefreshTokenRepository } from '@repositories/interfaces/IRefreshTokenRepository';
import { TOKENS } from '@config/container';
import { HashHelper } from '@utils/hash';
import { TokenHelper } from '@utils/jwt';
import { ConflictError, UnauthorizedError, ForbiddenError } from '@utils/errors';
import { Role, User } from '@entities/User';
import { RefreshToken } from '@entities/RefreshToken';
import redisConfig from '@config/redis';
import { emailQueue } from '@config/queue';

export interface AuthResponse {
  id: string;
  email: string;
  userName: string;
  role: Role;
  accessToken: string;
  refreshToken: string;
}

@injectable()
export class AuthService {
  constructor(
    @inject(TOKENS.USER_REPOSITORY) private userRepository: IUserRepository,
    @inject(TOKENS.REFRESH_TOKEN_REPOSITORY) private refreshTokenRepository: IRefreshTokenRepository
  ) {}

  async register(data: RegisterDto): Promise<{ message: string }> {
    // Check if user already exists
    const existingUser = await this.userRepository.findByEmail(data.email);
    if (existingUser) {
      throw new ConflictError('Email already registered');
    }

    // Hash password
    const passwordHash = await HashHelper.hash(data.password);

    // Create user
    const user = await this.userRepository.create({
      email: data.email,
      userName: data.userName,
      passwordHash,
      role: Role.CUSTOMER,
      isVerified: false,
    } as any);

    // Generate 4 digit code
    const verificationCode = Math.floor(1000 + Math.random() * 9000).toString();
    
    // Save to Redis (expires in 15 mins)
    await redisConfig.setex(`verify_code:${data.email}`, 15 * 60, verificationCode);
    
    // Push to email queue
    await emailQueue.add('sendVerificationCode', {
      to: data.email,
      subject: 'Xác thực tài khoản BookStore',
      html: `<h1>Mã xác thực của bạn</h1><p>Mã của bạn là: <strong style="font-size:24px;">${verificationCode}</strong></p><p>Mã này sẽ hết hạn trong 15 phút.</p>`
    });

    return {
      message: 'Đăng ký thành công. Vui lòng kiểm tra email để nhận mã xác thực.',
    };
  }

  async verifyEmail(data: VerifyEmailDto): Promise<AuthResponse> {
    const { email, code } = data;
    
    // Check redis
    const storedCode = await redisConfig.get(`verify_code:${email}`);
    if (!storedCode || storedCode !== code) {
      throw new UnauthorizedError('Mã xác thực không hợp lệ hoặc đã hết hạn');
    }
    
    const user = await this.userRepository.findByEmail(email);
    if (!user) {
      throw new UnauthorizedError('Không tìm thấy user');
    }
    
    // Update user
    user.isVerified = true;
    await this.userRepository.update(user.id, user);
    
    // Remove code from redis
    await redisConfig.del(`verify_code:${email}`);
    
    // Generate tokens
    const accessToken = TokenHelper.generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const refreshTokenValue = TokenHelper.generateRefreshToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    // Store refresh token in database
    await this.createRefreshTokenRecord(user.id, refreshTokenValue);

    return {
      id: user.id,
      userName: user.userName,
      email: user.email,
      role: user.role,
      accessToken,
      refreshToken: refreshTokenValue,
    };
  }

  async login(data: LoginDto): Promise<AuthResponse> {
    // Find user by email
    const user = await this.userRepository.findByEmail(data.email);
    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
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
      throw new UnauthorizedError('Invalid email or password');
    }

    // Generate tokens
    const accessToken = TokenHelper.generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const refreshTokenValue = TokenHelper.generateRefreshToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    // Store refresh token in database
    await this.createRefreshTokenRecord(user.id, refreshTokenValue);

    return {
      id: user.id,
      userName: user.userName,
      email: user.email,
      role: user.role,
      accessToken,
      refreshToken: refreshTokenValue,
    };
  }

  async refreshToken(token: string): Promise<AuthResponse> {
    // Find refresh token in database
    const refreshTokenRecord = await this.refreshTokenRepository.findByToken(token);
    if (!refreshTokenRecord || refreshTokenRecord.isRevoked) {
      throw new UnauthorizedError('Invalid or revoked refresh token');
    }

    // Verify token is not expired
    if (new Date() > refreshTokenRecord.expiresAt) {
      await this.refreshTokenRepository.revoke(refreshTokenRecord.id);
      throw new UnauthorizedError('Refresh token expired');
    }

    // Verify JWT signature
    try {
      TokenHelper.verifyRefreshToken(token);
    } catch {
      throw new UnauthorizedError('Invalid refresh token');
    }

    const user = refreshTokenRecord.user;

    if (user.isLocked) {
      throw new ForbiddenError('Tài khoản của bạn đã bị khóa. Vui lòng liên hệ Admin.');
    }

    // Generate new token pair
    const accessToken = TokenHelper.generateAccessToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    const newRefreshTokenValue = TokenHelper.generateRefreshToken({
      userId: user.id,
      email: user.email,
      role: user.role,
    });

    // Revoke old refresh token
    await this.refreshTokenRepository.revoke(refreshTokenRecord.id);

    // Store new refresh token
    await this.createRefreshTokenRecord(user.id, newRefreshTokenValue);

    return {
      id: user.id,
      userName: user.userName,
      email: user.email,
      role: user.role,
      accessToken,
      refreshToken: newRefreshTokenValue,
    };
  }

  async logout(userId: string): Promise<void> {
    // Revoke all active refresh tokens for user
    await this.refreshTokenRepository.revokeAllByUserId(userId);
  }

  private async createRefreshTokenRecord(userId: string, token: string): Promise<RefreshToken> {
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7); // 7 days

    return this.refreshTokenRepository.create({
      userId,
      token,
      expiresAt,
      isRevoked: false,
    } as any);
  }
}
