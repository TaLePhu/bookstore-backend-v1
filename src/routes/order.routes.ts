import { Router } from 'express';
import { OrderController } from '@controllers/OrderController';
import { authMiddleware } from '@middlewares/auth.middleware';
import { validateDto } from '@middlewares/validate.middleware';
import { CreateOrderDto } from '@dtos/order/CreateOrderDto';

const router = Router();

// Tất cả route Order đều yêu cầu đăng nhập
router.use(authMiddleware);

// Đặt hàng (checkout từ Cart)
router.post('/', validateDto(CreateOrderDto), OrderController.createOrder);

// Lấy danh sách đơn hàng của user (có phân trang: ?page=1&limit=10)
// ⚠️ Phải đặt TRƯỚC /:id để tránh Express match "my" như một orderId
router.get('/my', OrderController.getMyOrders);

// Lấy chi tiết một đơn hàng theo id
router.get('/:id', OrderController.getOrderById);

export default router;
