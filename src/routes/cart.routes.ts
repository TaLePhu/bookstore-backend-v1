import { Router } from 'express';
import { container } from 'tsyringe';
import { CartController } from '@controllers/CartController';
import { authMiddleware } from '@middlewares/auth.middleware';
import { validateDto } from '@middlewares/validate.middleware';
import { AddToCartDto } from '@dtos/cart/AddToCartDto';
import { UpdateCartItemDto } from '@dtos/cart/UpdateCartItemDto';

const router = Router();
const cartController = container.resolve(CartController);

// Tất cả route giỏ hàng đều yêu cầu đăng nhập
router.use(authMiddleware);

// Lấy giỏ hàng của user hiện tại
router.get('/', cartController.getCart);

// Thêm sản phẩm vào giỏ (validate body qua AddToCartDto)
router.post('/add', validateDto(AddToCartDto), cartController.addToCart);

// Cập nhật số lượng của một item (validate body qua UpdateCartItemDto)
router.put('/update/:itemId', validateDto(UpdateCartItemDto), cartController.updateCartItem);

// Xóa một item khỏi giỏ hàng
router.delete('/remove/:itemId', cartController.removeCartItem);

export default router;
