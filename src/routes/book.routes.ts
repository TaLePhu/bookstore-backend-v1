import { Router } from 'express';
import { container } from 'tsyringe';
import { BookController } from '@controllers/BookController';

const router = Router();
const bookController = container.resolve(BookController);

router.get('/latest', bookController.getLatestBooks);
router.get('/best-sellers', bookController.getBestSellerBooks);

// Lưu ý: các route cụ thể phải ở trước /:id để tránh Express hiểu nhầm là id
router.get('/search', bookController.searchBooks);
router.get('/category/:categoryId', bookController.getBooksByCategoryId);
router.get('/', bookController.getAllBooks);
router.get('/:id', bookController.getBookById);

export default router;
