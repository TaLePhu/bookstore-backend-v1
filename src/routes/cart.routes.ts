import { Router } from 'express';
import { CartController } from '@controllers/CartController';
import { authMiddleware } from '@middlewares/auth.middleware';
import { validateDto } from '@middlewares/validate.middleware';
import { AddToCartDto } from '@dtos/cart/AddToCartDto';
import { UpdateCartItemDto } from '@dtos/cart/UpdateCartItemDto';

const router = Router();

// Tất cả route giỏ hàng đều yêu cầu đăng nhập
router.use(authMiddleware);

// Lấy giỏ hàng của user hiện tại
router.get('/', CartController.getCart);

// Thêm sản phẩm vào giỏ (validate body qua AddToCartDto)
router.post('/add', validateDto(AddToCartDto), CartController.addToCart);

// Cập nhật số lượng của một item (validate body qua UpdateCartItemDto)
router.put('/update/:itemId', validateDto(UpdateCartItemDto), CartController.updateCartItem);

// Xóa một item khỏi giỏ hàng
router.delete('/remove/:itemId', CartController.removeCartItem);

export default router;
