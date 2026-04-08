import { injectable, inject } from 'tsyringe';
import { UpdateProfileDto } from '@dtos/user/UpdateProfileDto';
import { ChangePasswordDto } from '@dtos/user/ChangePasswordDto';
import { IUserRepository } from '@repositories/interfaces/IUserRepository';
import { IRefreshTokenRepository } from '@repositories/interfaces/IRefreshTokenRepository';
import { TOKENS } from '@config/container';
import { NotFoundError, UnauthorizedError } from '@utils/errors';
import { Role } from '@entities/User';
import { UserAdvance } from '@entities/UserAdvance';
import { HashHelper } from '@utils/hash';
import { TokenHelper } from '@utils/jwt';
import { RefreshToken } from '@entities/RefreshToken';

export interface UserProfileResponse {
  id: string;
  userName: string;
  email: string;
  fullName?: string;
  role: Role;
  isVerified: boolean;
  avatar?: string;
  dob?: Date;
  gender?: string;
  phone?: string;
  address?: string;
  createdAt: Date;
}

@injectable()
export class UserService {
  constructor(
    @inject(TOKENS.USER_REPOSITORY) private userRepository: IUserRepository,
    @inject(TOKENS.REFRESH_TOKEN_REPOSITORY) private refreshTokenRepository: IRefreshTokenRepository
  ) {}

  async getProfile(userId: string): Promise<UserProfileResponse> {
    const user = await this.userRepository.findById(userId, ['userAdvance']);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    return this.mapToProfileResponse(user);
  }

  async updateProfile(userId: string, data: UpdateProfileDto): Promise<UserProfileResponse> {
    const user = await this.userRepository.findById(userId, ['userAdvance']);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (data.fullName !== undefined) {
      user.fullName = data.fullName;
    }

    // Process user advance fields
    const advanceFields = ['avatar', 'dob', 'gender', 'phone', 'address'];
    const hasAdvanceUpdate = advanceFields.some((field) => data[field as keyof UpdateProfileDto] !== undefined);

    if (hasAdvanceUpdate) {
      if (!user.userAdvance) {
        user.userAdvance = new UserAdvance();
      }
      
      if (data.avatar !== undefined) user.userAdvance.avatar = data.avatar;
      if (data.dob !== undefined) user.userAdvance.dob = new Date(data.dob);
      if (data.gender !== undefined) user.userAdvance.gender = data.gender;
      if (data.phone !== undefined) user.userAdvance.phone = data.phone;
      if (data.address !== undefined) user.userAdvance.address = data.address;
    }

    const updatedUser = await this.userRepository.update(userId, user);
    if (!updatedUser) {
      throw new NotFoundError('Failed to update user');
    }

    // Refresh loaded relations
    const finalUser = await this.userRepository.findById(userId, ['userAdvance']);
    return this.mapToProfileResponse(finalUser!);
  }

  async changePassword(userId: string, data: ChangePasswordDto) {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    // Verify old password
    const isPasswordValid = await HashHelper.compare(data.oldPassword, user.passwordHash);
    if (!isPasswordValid) {
      throw new UnauthorizedError('Incorrect old password');
    }

    // Hash new password
    user.passwordHash = await HashHelper.hash(data.newPassword);
    await this.userRepository.update(userId, user);

    // Invalidate all tokens
    await this.refreshTokenRepository.revokeAllByUserId(userId);

    // Generate new token pair
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

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.refreshTokenRepository.create({
      userId: user.id,
      token: refreshTokenValue,
      expiresAt,
      isRevoked: false,
    } as any);

    return {
      accessToken,
      refreshToken: refreshTokenValue,
      message: 'Password changed successfully',
    };
  }

  private mapToProfileResponse(user: any): UserProfileResponse {
    return {
      id: user.id,
      userName: user.userName,
      email: user.email,
      fullName: user.fullName,
      role: user.role,
      isVerified: user.isVerified,
      avatar: user.userAdvance?.avatar,
      dob: user.userAdvance?.dob,
      gender: user.userAdvance?.gender,
      phone: user.userAdvance?.phone,
      address: user.userAdvance?.address,
      createdAt: user.createdAt,
    };
  }
}
