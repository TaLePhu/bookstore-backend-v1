import { Router } from 'express';
import { container } from 'tsyringe';
import { BookController } from '@controllers/BookController';

const router = Router();
const bookController = container.resolve(BookController);

// Lưu ý: /search phải ở trước /:id để tránh Express hiểu nhầm "search" là một id
router.get('/search', bookController.searchBooks);
router.get('/', bookController.getAllBooks);
router.get('/:id', bookController.getBookById);

export default router;
