import { NextFunction, Request, Response } from 'express';
import { injectable } from 'tsyringe';
import { AdminMarketingService } from '@services/AdminMarketingService';
import { sendSuccess } from '@utils/response';

@injectable()
export class AdminMarketingController {
  constructor(private adminMarketingService: AdminMarketingService) {}

  listInsights = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const insights = await this.adminMarketingService.listInsights();
      sendSuccess(res, insights, 'Lấy gợi ý marketing thành công');
    } catch (error) {
      next(error);
    }
  };

  generateCampaignDraft = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const draft = await this.adminMarketingService.generateCampaignDraft(String(req.body?.insightId || ''));
      sendSuccess(res, draft, 'Tạo bản nháp chiến dịch marketing thành công');
    } catch (error) {
      next(error);
    }
  };
}
