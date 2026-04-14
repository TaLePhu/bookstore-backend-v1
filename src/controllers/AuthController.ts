import { Request, Response } from 'express';
import { injectable, inject } from 'tsyringe';
import { AuthService } from '@services/AuthService';
import { RegisterDto } from '@dtos/auth/RegisterDto';
import { LoginDto } from '@dtos/auth/LoginDto';
import { RefreshTokenDto } from '@dtos/auth/RefreshTokenDto';
import { VerifyEmailDto } from '@dtos/auth/VerifyEmailDto';
import { ResendVerificationCodeDto } from '@dtos/auth/ResendVerificationCodeDto';
import { sendSuccess, sendError } from '@utils/response';
import { asyncWrapper } from '@utils/async-wrapper';

@injectable()
export class AuthController {
  constructor(private authService: AuthService) {}

  register = asyncWrapper(async (req: Request, res: Response) => {
    const registerDto: RegisterDto = req.body;
    const result = await this.authService.register(registerDto);
    return sendSuccess(res, result, 'User registered successfully', 201);
  });

  verifyEmail = asyncWrapper(async (req: Request, res: Response) => {
    const verifyEmailDto: VerifyEmailDto = req.body;
    const result = await this.authService.verifyEmail(verifyEmailDto);
    return sendSuccess(res, result, 'Email verified successfully', 200);
  });

  resendVerificationCode = asyncWrapper(async (req: Request, res: Response) => {
    const resendDto: ResendVerificationCodeDto = req.body;
    const result = await this.authService.resendVerificationCode(resendDto);
    return sendSuccess(res, result, 'Verification code resent successfully', 200);
  });

  login = asyncWrapper(async (req: Request, res: Response) => {
    const loginDto: LoginDto = req.body;
    const result = await this.authService.login(loginDto);
    return sendSuccess(res, result, 'Login successful');
  });

  refreshToken = asyncWrapper(async (req: Request, res: Response) => {
    const { refreshToken }: RefreshTokenDto = req.body;
    const result = await this.authService.refreshToken(refreshToken);
    return sendSuccess(res, result, 'Token refreshed successfully');
  });

  logout = asyncWrapper(async (req: Request, res: Response) => {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return sendError(res, 'Unauthorized', 401);
    }
    await this.authService.logout(userId);
    return sendSuccess(res, {}, 'Logged out successfully');
  });
}
