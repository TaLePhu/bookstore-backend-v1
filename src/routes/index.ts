import { Router } from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import bookRoutes from './book.routes';
import categoryRoutes from './category.routes';
import cartRoutes from './cart.routes';
import orderRoutes from './order.routes';
import adminRoutes from './admin.routes';
import addressRoutes from './address.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/books', bookRoutes);
router.use('/categories', categoryRoutes);
router.use('/cart', cartRoutes);
router.use('/orders', orderRoutes);
router.use('/admin', adminRoutes);
router.use('/addresses', addressRoutes);

export default router;

