import { Request, Response, Router } from 'express';
import rateLimit from 'express-rate-limit';
import { container } from 'tsyringe';
import { AuthController } from '@controllers/AuthController';
import { validateDto } from '@middlewares/validate.middleware';
import { authMiddleware } from '@middlewares/auth.middleware';
import { RegisterDto } from '@dtos/auth/RegisterDto';
import { LoginDto } from '@dtos/auth/LoginDto';
import { RefreshTokenDto } from '@dtos/auth/RefreshTokenDto';
import { VerifyEmailDto } from '@dtos/auth/VerifyEmailDto';
import { ResendVerificationCodeDto } from '@dtos/auth/ResendVerificationCodeDto';
import { ForgotPasswordDto } from '@dtos/auth/ForgotPasswordDto';
import { VerifyPasswordResetCodeDto } from '@dtos/auth/VerifyPasswordResetCodeDto';
import { ResetPasswordDto } from '@dtos/auth/ResetPasswordDto';

const router = Router();
const authController = container.resolve(AuthController);

function getRetryAfterSeconds(req: Request): number | null {
  const rateLimitInfo = (req as any).rateLimit;
  if (!rateLimitInfo?.resetTime) {
    return null;
  }

  const resetAt = new Date(rateLimitInfo.resetTime).getTime();
  const seconds = Math.ceil((resetAt - Date.now()) / 1000);
  return seconds > 0 ? seconds : 0;
}

const loginLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    const retryAfterSeconds = getRetryAfterSeconds(req);
    res.status(429).json({
      success: false,
      message: 'Bạn đã thử đăng nhập quá nhiều lần. Vui lòng chờ ít phút rồi thử lại.',
      data: {
        retryAfterSeconds,
      },
    });
  },
});

const authActionLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 15,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    const retryAfterSeconds = getRetryAfterSeconds(req);
    res.status(429).json({
      success: false,
      message: 'Bạn đã thao tác quá nhiều lần. Vui lòng thử lại sau ít phút.',
      data: {
        retryAfterSeconds,
      },
    });
  },
});

const verifyCodeLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req: Request, res: Response) => {
    const retryAfterSeconds = getRetryAfterSeconds(req);
    res.status(429).json({
      success: false,
      message: 'Bạn đã nhập mã xác thực quá số lần cho phép. Vui lòng chờ rồi dùng chức năng gửi lại mã.',
      data: {
        retryAfterSeconds,
      },
    });
  },
});

// Public routes
router.get('/check-email', authController.checkEmail);
router.post('/register', authActionLimiter, validateDto(RegisterDto), authController.register);
router.post('/verify-email', verifyCodeLimiter, validateDto(VerifyEmailDto), authController.verifyEmail);
router.post('/resend-code', authActionLimiter, validateDto(ResendVerificationCodeDto), authController.resendVerificationCode);
router.post('/forgot-password', authActionLimiter, validateDto(ForgotPasswordDto), authController.forgotPassword);
router.post('/verify-reset-code', verifyCodeLimiter, validateDto(VerifyPasswordResetCodeDto), authController.verifyPasswordResetCode);
router.post('/reset-password', authActionLimiter, validateDto(ResetPasswordDto), authController.resetPassword);
router.post('/login', loginLimiter, validateDto(LoginDto), authController.login);
router.post('/refresh-token', authActionLimiter, validateDto(RefreshTokenDto), authController.refreshToken);

// Protected routes
router.post('/logout', authMiddleware, authController.logout);

export default router;
