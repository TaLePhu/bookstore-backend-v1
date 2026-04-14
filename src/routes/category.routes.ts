import { Router } from 'express';
import { container } from 'tsyringe';
import { CategoryController } from '@controllers/CategoryController';

const router = Router();
const categoryController = container.resolve(CategoryController);

router.get('/', categoryController.getAllCategories);

export default router;
