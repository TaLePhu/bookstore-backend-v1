import { Router } from 'express';
import { container } from 'tsyringe';
import { OrderController } from '@controllers/OrderController';
import { authMiddleware } from '@middlewares/auth.middleware';
import { validateDto } from '@middlewares/validate.middleware';
import { CreateOrderDto } from '@dtos/order/CreateOrderDto';

const router = Router();
const orderController = container.resolve(OrderController);

router.post('/guest', validateDto(CreateOrderDto), orderController.createGuestOrder);
router.get('/track', orderController.trackOrder);
router.post('/cancel-request', orderController.requestCancelOrder);
router.post('/review', orderController.submitOrderReview);

router.use(authMiddleware);

router.post('/', validateDto(CreateOrderDto), orderController.createOrder);
router.get('/my', orderController.getMyOrders);
router.get('/:id', orderController.getOrderById);

export default router;
