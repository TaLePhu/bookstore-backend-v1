import { Router } from 'express';
import authRoutes from './auth.routes';
import userRoutes from './user.routes';
import bookRoutes from './book.routes';
import categoryRoutes from './category.routes';
import cartRoutes from './cart.routes';
import orderRoutes from './order.routes';
import adminRoutes from './admin.routes';
import addressRoutes from './address.routes';
import managementRoutes from './management.routes';
import aiAdvisorRoutes from './ai-advisor.routes';
import promotionRoutes from './promotion.routes';

const router = Router();

router.use('/auth', authRoutes);
router.use('/users', userRoutes);
router.use('/books', bookRoutes);
router.use('/categories', categoryRoutes);
router.use('/cart', cartRoutes);
router.use('/orders', orderRoutes);
router.use('/admin', adminRoutes);
router.use('/management', managementRoutes);
router.use('/addresses', addressRoutes);
router.use('/ai-advisor', aiAdvisorRoutes);
router.use('/promotions', promotionRoutes);

export default router;

