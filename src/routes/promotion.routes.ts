import { Router } from 'express';
import { container } from 'tsyringe';
import { PromotionController } from '@controllers/PromotionController';

const router = Router();
const promotionController = container.resolve(PromotionController);

router.get('/', promotionController.getPromotions);

export default router;
