import { Router } from 'express';
import { container } from 'tsyringe';
import { UserController } from '@controllers/UserController';
import { authMiddleware } from '@middlewares/auth.middleware';
import { validateDto } from '@middlewares/validate.middleware';
import { UpdateProfileDto } from '@dtos/user/UpdateProfileDto';
import { ChangePasswordDto } from '@dtos/user/ChangePasswordDto';

const router = Router();
const userController = container.resolve(UserController);

// All user routes are protected
router.use(authMiddleware);

router.get('/me', userController.getProfile);
router.patch('/me', validateDto(UpdateProfileDto), userController.updateProfile);
router.put('/change-password', validateDto(ChangePasswordDto), userController.changePassword);

export default router;
