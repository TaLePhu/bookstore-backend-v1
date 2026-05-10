import { Request, Response, NextFunction } from 'express';
import { injectable } from 'tsyringe';
import { CategoryService } from '@services/CategoryService';
import { AppError } from '@utils/errors';

@injectable()
export class AdminCategoryController {
  constructor(private categoryService: CategoryService) {}

  getAllCategories = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const includeDeleted = req.query.include_deleted === 'true';
      const onlyDeleted = req.query.only_deleted === 'true';
      const categories = await this.categoryService.getAllCategories({ includeDeleted, onlyDeleted });

      res.status(200).json({
        success: true,
        data: categories,
      });
    } catch (error) {
      next(error);
    }
  };

  getCategoryById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const category = await this.categoryService.getCategoryById(id, true);

      if (!category) {
        throw new AppError('Khong tim thay the loai', 404);
      }

      res.status(200).json({
        success: true,
        data: category,
      });
    } catch (error) {
      next(error);
    }
  };

  createCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const newCategory = await this.categoryService.createCategory(req.body);

      res.status(201).json({
        success: true,
        message: 'Tao the loai thanh cong',
        data: newCategory,
      });
    } catch (error) {
      next(error);
    }
  };

  updateCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const updatedCategory = await this.categoryService.updateCategory(id, req.body);

      if (!updatedCategory) {
        throw new AppError('Khong tim thay the loai', 404);
      }

      res.status(200).json({
        success: true,
        message: 'Cap nhat the loai thanh cong',
        data: updatedCategory,
      });
    } catch (error) {
      next(error);
    }
  };

  deleteCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const success = await this.categoryService.softDeleteCategory(id);

      if (!success) {
        throw new AppError('Khong tim thay the loai de xoa mem', 404);
      }

      res.status(200).json({
        success: true,
        message: 'Xoa mem the loai thanh cong',
      });
    } catch (error) {
      next(error);
    }
  };

  restoreCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const success = await this.categoryService.restoreCategory(id);

      if (!success) {
        throw new AppError('Khong tim thay the loai de khoi phuc', 404);
      }

      res.status(200).json({
        success: true,
        message: 'Khoi phuc the loai thanh cong',
      });
    } catch (error) {
      next(error);
    }
  };

  hardDeleteCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const success = await this.categoryService.hardDeleteCategory(id);

      if (!success) {
        throw new AppError('Khong tim thay the loai de xoa cung', 404);
      }

      res.status(200).json({
        success: true,
        message: 'Xoa cung the loai thanh cong',
      });
    } catch (error) {
      next(error);
    }
  };
}
