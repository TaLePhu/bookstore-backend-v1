import { NextFunction, Request, Response } from 'express';
import { injectable } from 'tsyringe';
import { AdminDashboardService } from '@services/AdminDashboardService';

@injectable()
export class AdminDashboardController {
  constructor(private adminDashboardService: AdminDashboardService) {}

  getDashboard = async (_req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const data = await this.adminDashboardService.getDashboard();
      res.status(200).json({
        success: true,
        data,
      });
    } catch (error) {
      next(error);
    }
  };
}
