import { Request, Response } from 'express';
import { injectable, inject } from 'tsyringe';
import { UserService } from '@services/UserService';
import { UpdateProfileDto } from '@dtos/user/UpdateProfileDto';
import { ChangePasswordDto } from '@dtos/user/ChangePasswordDto';
import { sendSuccess, sendError } from '@utils/response';
import { asyncWrapper } from '@utils/async-wrapper';

@injectable()
export class UserController {
  constructor(private userService: UserService) {}

  getProfile = asyncWrapper(async (req: Request, res: Response) => {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return sendError(res, 'Unauthorized', 401);
    }
    const profile = await this.userService.getProfile(userId);
    return sendSuccess(res, profile, 'Profile retrieved successfully');
  });

  updateProfile = asyncWrapper(async (req: Request, res: Response) => {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return sendError(res, 'Unauthorized', 401);
    }
    const updateDto: UpdateProfileDto = req.body;
    const profile = await this.userService.updateProfile(userId, updateDto);
    return sendSuccess(res, profile, 'Profile updated successfully');
  });

  changePassword = asyncWrapper(async (req: Request, res: Response) => {
    const userId = (req as any).user?.userId;
    const deviceId = (req as any).user?.deviceId;
    if (!userId) {
      return sendError(res, 'Unauthorized', 401);
    }
    if (!deviceId) {
      return sendError(res, 'Unauthorized', 401);
    }
    const changePasswordDto: ChangePasswordDto = req.body;
    const result = await this.userService.changePassword(userId, deviceId, changePasswordDto);
    return sendSuccess(res, { accessToken: result.accessToken, refreshToken: result.refreshToken, deviceId }, result.message);
  });
}
