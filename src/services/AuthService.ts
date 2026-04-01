import { injectable, inject } from 'tsyringe';
import { RegisterDto } from '@dtos/auth/RegisterDto';
import { LoginDto } from '@dtos/auth/LoginDto';
import { IUserRepository } from '@repositories/interfaces/IUserRepository';
import { IRefreshTokenRepository } from '@repositories/interfaces/IRefreshTokenRepository';
import { TOKENS } from '@config/container';
import { HashHelper } from '@utils/hash';
import { TokenHelper } from '@utils/jwt';
import { ConflictError, UnauthorizedError } from '@utils/errors';
import { Role } from '@entities/User';
import { RefreshToken } from '@entities/RefreshToken';

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    name: string;
    role: Role;
  };
}

@injectable()
export class AuthService {
  constructor(
    @inject(TOKENS.USER_REPOSITORY) private userRepository: IUserRepository,
    @inject(TOKENS.REFRESH_TOKEN_REPOSITORY) private refreshTokenRepository: IRefreshTokenRepository
  ) {}

  async register(data: RegisterDto): Promise<AuthResponse> {
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
      name: data.name,
      passwordHash,
      role: Role.CUSTOMER,
    });

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
    const refreshTokenData = await this.createRefreshTokenRecord(user.id, refreshTokenValue);

    return {
      accessToken,
      refreshToken: refreshTokenData.token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
    };
  }

  async login(data: LoginDto): Promise<AuthResponse> {
    // Find user by email
    const user = await this.userRepository.findByEmail(data.email);
    if (!user) {
      throw new UnauthorizedError('Invalid email or password');
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
    const refreshTokenData = await this.createRefreshTokenRecord(user.id, refreshTokenValue);

    return {
      accessToken,
      refreshToken: refreshTokenData.token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
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
    const newRefreshTokenData = await this.createRefreshTokenRecord(user.id, newRefreshTokenValue);

    return {
      accessToken,
      refreshToken: newRefreshTokenData.token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
      },
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
    });
  }
}
