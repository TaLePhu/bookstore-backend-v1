import { injectable, inject } from 'tsyringe';
import { UpdateProfileDto } from '@dtos/user/UpdateProfileDto';
import { IUserRepository } from '@repositories/interfaces/IUserRepository';
import { TOKENS } from '@config/container';
import { NotFoundError } from '@utils/errors';
import { Role } from '@entities/User';

export interface UserProfileResponse {
  id: string;
  name: string;
  email: string;
  role: Role;
  createdAt: Date;
}

@injectable()
export class UserService {
  constructor(@inject(TOKENS.USER_REPOSITORY) private userRepository: IUserRepository) {}

  async getProfile(userId: string): Promise<UserProfileResponse> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt,
    };
  }

  async updateProfile(userId: string, data: UpdateProfileDto): Promise<UserProfileResponse> {
    const user = await this.userRepository.findById(userId);
    if (!user) {
      throw new NotFoundError('User not found');
    }

    if (data.name) {
      user.name = data.name;
    }

    const updatedUser = await this.userRepository.update(userId, user);
    if (!updatedUser) {
      throw new NotFoundError('Failed to update user');
    }

    return {
      id: updatedUser.id,
      name: updatedUser.name,
      email: updatedUser.email,
      role: updatedUser.role,
      createdAt: updatedUser.createdAt,
    };
  }
}
