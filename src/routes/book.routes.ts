import { Router } from 'express';
import { container } from 'tsyringe';
import { BookController } from '@controllers/BookController';
import { optionalAuthMiddleware } from '@middlewares/auth.middleware';

const router = Router();
const bookController = container.resolve(BookController);

// Lưu ý: các route cụ thể phải ở trước /:id để tránh Express hiểu nhầm là id
router.get('/recommendations/home', optionalAuthMiddleware, bookController.getHomeRecommendations);
router.get('/semantic-search', bookController.semanticSearchBooks);
router.get('/smart-search', optionalAuthMiddleware, bookController.smartSearchBooks);
router.get('/search', optionalAuthMiddleware, bookController.searchBooks);
router.get('/', bookController.getAllBooks);
router.get('/:id/related', bookController.getRelatedBooks);
router.get('/:id', optionalAuthMiddleware, bookController.getBookById);

export default router;
