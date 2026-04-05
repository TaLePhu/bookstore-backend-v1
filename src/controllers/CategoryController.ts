import { Request, Response, NextFunction } from 'express';
import { container } from 'tsyringe';
import { CategoryService } from '@services/CategoryService';

export class CategoryController {
  static async getAllCategories(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const categoryService = container.resolve(CategoryService);
      const categories = await categoryService.getAllCategories();
      
      res.status(200).json({
        success: true,
        data: categories
      });
    } catch (error) {
      next(error);
    }
  }
}
