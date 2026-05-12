import { Request, Response } from 'express';
import { injectable, inject } from 'tsyringe';
import { AuthService } from '@services/AuthService';
import { RegisterDto } from '@dtos/auth/RegisterDto';
import { LoginDto } from '@dtos/auth/LoginDto';
import { RefreshTokenDto } from '@dtos/auth/RefreshTokenDto';
import { VerifyEmailDto } from '@dtos/auth/VerifyEmailDto';
import { ResendVerificationCodeDto } from '@dtos/auth/ResendVerificationCodeDto';
import { ForgotPasswordDto } from '@dtos/auth/ForgotPasswordDto';
import { VerifyPasswordResetCodeDto } from '@dtos/auth/VerifyPasswordResetCodeDto';
import { ResetPasswordDto } from '@dtos/auth/ResetPasswordDto';
import { sendSuccess, sendError } from '@utils/response';
import { asyncWrapper } from '@utils/async-wrapper';

@injectable()
export class AuthController {
  constructor(private authService: AuthService) {}

  checkEmail = asyncWrapper(async (req: Request, res: Response) => {
    const email = typeof req.query.email === 'string' ? req.query.email.trim() : '';
    if (!email) {
      return sendError(res, 'Vui lòng nhập email', 400);
    }

    const result = await this.authService.checkEmailExists(email);
    return sendSuccess(res, result, 'Kiểm tra email thành công');
  });

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

  forgotPassword = asyncWrapper(async (req: Request, res: Response) => {
    const dto: ForgotPasswordDto = req.body;
    const result = await this.authService.requestPasswordReset(dto);
    return sendSuccess(res, result, 'Password reset code sent successfully', 200);
  });

  verifyPasswordResetCode = asyncWrapper(async (req: Request, res: Response) => {
    const dto: VerifyPasswordResetCodeDto = req.body;
    const result = await this.authService.verifyPasswordResetCode(dto);
    return sendSuccess(res, result, 'Password reset code verified successfully', 200);
  });

  resetPassword = asyncWrapper(async (req: Request, res: Response) => {
    const dto: ResetPasswordDto = req.body;
    const result = await this.authService.resetPassword(dto);
    return sendSuccess(res, result, 'Password reset successfully', 200);
  });

  login = asyncWrapper(async (req: Request, res: Response) => {
    const loginDto: LoginDto = req.body;
    const result = await this.authService.login(loginDto);
    return sendSuccess(res, result, 'Login successful');
  });

  refreshToken = asyncWrapper(async (req: Request, res: Response) => {
    const { refreshToken, deviceId }: RefreshTokenDto = req.body;
    const result = await this.authService.refreshToken(refreshToken, deviceId);
    return sendSuccess(res, result, 'Token refreshed successfully');
  });

  logout = asyncWrapper(async (req: Request, res: Response) => {
    const userId = (req as any).user?.userId;
    const deviceId = (req as any).user?.deviceId;
    if (!userId) {
      return sendError(res, 'Unauthorized', 401);
    }
    if (!deviceId) {
      return sendError(res, 'Unauthorized', 401);
    }
    await this.authService.logout(userId, deviceId);
    return sendSuccess(res, {}, 'Logged out successfully');
  });
}
