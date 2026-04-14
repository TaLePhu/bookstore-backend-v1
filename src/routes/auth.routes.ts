import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import { container } from 'tsyringe';
import { AuthController } from '@controllers/AuthController';
import { validateDto } from '@middlewares/validate.middleware';
import { authMiddleware } from '@middlewares/auth.middleware';
import { RegisterDto } from '@dtos/auth/RegisterDto';
import { LoginDto } from '@dtos/auth/LoginDto';
import { RefreshTokenDto } from '@dtos/auth/RefreshTokenDto';
import { VerifyEmailDto } from '@dtos/auth/VerifyEmailDto';

const router = Router();
const authController = container.resolve(AuthController);

const authWriteLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 10,
	standardHeaders: true,
	legacyHeaders: false,
	message: 'Too many authentication attempts. Please try again later.',
});

const verifyEmailLimiter = rateLimit({
	windowMs: 15 * 60 * 1000,
	max: 5,
	standardHeaders: true,
	legacyHeaders: false,
	message: 'Too many verification attempts. Please try again later.',
});

// Public routes
router.post('/register', authWriteLimiter, validateDto(RegisterDto), authController.register);
router.post('/verify-email', verifyEmailLimiter, validateDto(VerifyEmailDto), authController.verifyEmail);
router.post('/login', authWriteLimiter, validateDto(LoginDto), authController.login);
router.post('/refresh-token', authWriteLimiter, validateDto(RefreshTokenDto), authController.refreshToken);

// Protected routes
router.post('/logout', authMiddleware, authController.logout);

export default router;
