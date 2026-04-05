import { Router } from 'express';
import { BookController } from '@controllers/BookController';

const router = Router();

// Lưu ý: /search phải ở trước /:id để tránh Express hiểu nhầm "search" là một id
router.get('/search', BookController.searchBooks);
router.get('/', BookController.getAllBooks);
router.get('/:id', BookController.getBookById);

export default router;
