import { Request, Response, NextFunction } from 'express';
import { injectable } from 'tsyringe';
import { CategoryService } from '@services/CategoryService';

@injectable()
export class CategoryController {
  constructor(private categoryService: CategoryService) {}

  getAllCategories = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const categories = await this.categoryService.getAllCategories();
      
      res.status(200).json({
        success: true,
        data: categories
      });
    } catch (error) {
      next(error);
    }
  };
}
