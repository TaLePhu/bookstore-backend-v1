import { Request, Response, NextFunction } from 'express';
import { injectable } from 'tsyringe';
import { AdminPromotionService } from '@services/AdminPromotionService';
import { PromotionStatus } from '@entities/Promotion';
import { sendSuccess } from '@utils/response';

@injectable()
export class AdminPromotionController {
  constructor(private adminPromotionService: AdminPromotionService) {}

  listPromotions = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const promotions = await this.adminPromotionService.listPromotions();
      sendSuccess(res, promotions, 'Lấy danh sách chương trình khuyến mãi thành công');
    } catch (error) {
      next(error);
    }
  };

  createPromotion = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const bannerImage = req.file as Express.Multer.File | undefined;
      const promotion = await this.adminPromotionService.createPromotion(req.body, bannerImage);
      sendSuccess(res, promotion, 'Tạo chương trình khuyến mãi thành công', 201);
    } catch (error) {
      next(error);
    }
  };

  updatePromotion = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const bannerImage = req.file as Express.Multer.File | undefined;
      const promotion = await this.adminPromotionService.updatePromotion(req.params.id, req.body, bannerImage);
      sendSuccess(res, promotion, 'Cập nhật chương trình khuyến mãi thành công');
    } catch (error) {
      next(error);
    }
  };

  updatePromotionStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const status = req.body?.status as PromotionStatus;
      const promotion = await this.adminPromotionService.updatePromotionStatus(req.params.id, status);
      sendSuccess(res, promotion, 'Cập nhật trạng thái chương trình khuyến mãi thành công');
    } catch (error) {
      next(error);
    }
  };

  deletePromotion = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      await this.adminPromotionService.deletePromotion(req.params.id);
      sendSuccess(res, null, 'Xóa chương trình khuyến mãi thành công');
    } catch (error) {
      next(error);
    }
  };
}
