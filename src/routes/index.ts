import { Router } from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import bookRoutes from './book.routes';
import categoryRoutes from './category.routes';
import cartRoutes from './cart.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/books', bookRoutes);
router.use('/categories', categoryRoutes);
router.use('/cart', cartRoutes);

export default router;
