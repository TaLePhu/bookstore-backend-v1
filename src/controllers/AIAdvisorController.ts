import { NextFunction, Request, Response } from 'express';
import { injectable } from 'tsyringe';
import { AIAdvisorService } from '@services/AIAdvisorService';

@injectable()
export class AIAdvisorController {
  constructor(private aiAdvisorService: AIAdvisorService) {}

  advise = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const question = typeof req.body?.question === 'string' ? req.body.question : '';
      const parsedLimit = parseInt(String(req.body?.limit ?? ''), 10);
      const limit = Number.isFinite(parsedLimit) ? parsedLimit : 4;
      const history = Array.isArray(req.body?.history) ? req.body.history : [];

      const result = await this.aiAdvisorService.advise(question, limit, history);

      res.status(200).json({
        success: true,
        data: result,
      });
    } catch (error) {
      next(error);
    }
  };
}
