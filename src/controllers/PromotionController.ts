import { Request, Response, NextFunction } from 'express';
import { injectable } from 'tsyringe';
import { PromotionService } from '@services/PromotionService';
import { sendSuccess } from '@utils/response';

@injectable()
export class PromotionController {
  constructor(private promotionService: PromotionService) {}

  getPromotions = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const promotions = await this.promotionService.getPromotions();
      sendSuccess(res, promotions, 'Lấy dữ liệu khuyến mãi thành công');
    } catch (error) {
      next(error);
    }
  };
}
