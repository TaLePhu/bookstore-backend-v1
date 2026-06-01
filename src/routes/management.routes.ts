import { Router } from 'express';
import { container } from 'tsyringe';
import { authMiddleware } from '@middlewares/auth.middleware';
import { roleGuard } from '@middlewares/role.middleware';
import { Role } from '@entities/User';
import { validateDto } from '@middlewares/validate.middleware';
import { AdminOrderController } from '@controllers/AdminOrderController';
import { AdminBookController } from '@controllers/AdminBookController';
import { UpdateOrderStatusDto } from '@dtos/admin/UpdateOrderStatusDto';
import { RejectCancelRequestDto } from '@dtos/admin/RejectCancelRequestDto';

const router = Router();
const adminOrderController = container.resolve(AdminOrderController);
const adminBookController = container.resolve(AdminBookController);

router.use(authMiddleware);
router.use(roleGuard(Role.ADMIN, Role.STAFF));

router.get('/orders', adminOrderController.listOrders);
router.get('/orders/search', adminOrderController.searchByOrderCode);
router.get('/orders/stats', adminOrderController.getStats);
router.get('/orders/history', adminOrderController.getCustomerHistory);
router.get('/orders/:id', adminOrderController.getOrderById);
router.patch(
  '/orders/:id/status',
  validateDto(UpdateOrderStatusDto),
  adminOrderController.updateStatus
);
router.post(
  '/orders/:id/cancel-request/reject',
  validateDto(RejectCancelRequestDto),
  adminOrderController.rejectCancelRequest
);

router.get('/books', adminBookController.getAllBooks);
router.get('/books/search', adminBookController.searchBooks);
router.get('/books/:id', adminBookController.getBookById);

export default router;
