import { NextFunction, Request, Response } from 'express';
import { injectable } from 'tsyringe';
import { AIAdvisorService } from '@services/AIAdvisorService';
import { AIAdvisorConversationService } from '@services/AIAdvisorConversationService';

@injectable()
export class AIAdvisorController {
  constructor(
    private aiAdvisorService: AIAdvisorService,
    private conversationService: AIAdvisorConversationService
  ) {}

  advise = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const question = typeof req.body?.question === 'string' ? req.body.question : '';
      const parsedLimit = parseInt(String(req.body?.limit ?? ''), 10);
      const limit = Number.isFinite(parsedLimit) ? parsedLimit : 4;
      const history = Array.isArray(req.body?.history) ? req.body.history : [];
      const excludeBookIds = Array.isArray(req.body?.excludeBookIds) ? req.body.excludeBookIds : [];

      const result = await this.aiAdvisorService.advise(question, limit, history, excludeBookIds);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };

  listConversations = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const conversations = await this.conversationService.list(userId);

      res.status(200).json({
        success: true,
        data: conversations,
      });
    } catch (error) {
      next(error);
    }
  };

  createConversation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const conversation = await this.conversationService.create(userId, {
        title: req.body?.title,
        messages: req.body?.messages,
      });

      res.status(201).json({
        success: true,
        data: conversation,
      });
    } catch (error) {
      next(error);
    }
  };

  updateConversation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      const conversation = await this.conversationService.update(userId, req.params.id, {
        title: req.body?.title,
        messages: req.body?.messages,
      });

      res.status(200).json({
        success: true,
        data: conversation,
      });
    } catch (error) {
      next(error);
    }
  };

  deleteConversation = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.userId;
      await this.conversationService.delete(userId, req.params.id);

      res.status(200).json({
        success: true,
        data: { deleted: true },
      });
    } catch (error) {
      next(error);
    }
  };
}
