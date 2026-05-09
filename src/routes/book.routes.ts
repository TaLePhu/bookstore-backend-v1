import { Router } from 'express';
import { container } from 'tsyringe';
import { BookController } from '@controllers/BookController';

const router = Router();
const bookController = container.resolve(BookController);

// Lưu ý: các route cụ thể phải ở trước /:id để tránh Express hiểu nhầm là id
router.get('/semantic-search', bookController.semanticSearchBooks);
router.get('/search', bookController.searchBooks);
router.get('/', bookController.getAllBooks);
router.get('/:id/related', bookController.getRelatedBooks);
router.get('/:id', bookController.getBookById);

export default router;
