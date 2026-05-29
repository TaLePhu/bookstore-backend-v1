import { Router } from 'express';
import { container } from 'tsyringe';
import { AIAdvisorController } from '@controllers/AIAdvisorController';
import { authMiddleware, optionalAuthMiddleware } from '@middlewares/auth.middleware';

const router = Router();
const aiAdvisorController = container.resolve(AIAdvisorController);

router.post('/recommendations', optionalAuthMiddleware, aiAdvisorController.advise);
router.get('/conversations', authMiddleware, aiAdvisorController.listConversations);
router.post('/conversations', authMiddleware, aiAdvisorController.createConversation);
router.patch('/conversations/:id', authMiddleware, aiAdvisorController.updateConversation);
router.delete('/conversations/:id', authMiddleware, aiAdvisorController.deleteConversation);

export default router;
