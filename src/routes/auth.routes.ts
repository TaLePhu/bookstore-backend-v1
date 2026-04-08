import { Router } from 'express';
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

// Public routes
router.post('/register', validateDto(RegisterDto), authController.register);
router.post('/verify-email', validateDto(VerifyEmailDto), authController.verifyEmail);
router.post('/login', validateDto(LoginDto), authController.login);
router.post('/refresh-token', validateDto(RefreshTokenDto), authController.refreshToken);

// Protected routes
router.post('/logout', authMiddleware, authController.logout);

export default router;
