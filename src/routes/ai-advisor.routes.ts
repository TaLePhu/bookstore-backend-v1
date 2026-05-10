import { Router } from 'express';
import { container } from 'tsyringe';
import { AIAdvisorController } from '@controllers/AIAdvisorController';

const router = Router();
const aiAdvisorController = container.resolve(AIAdvisorController);

router.post('/recommendations', aiAdvisorController.advise);

export default router;
