import { Request, Response, NextFunction } from 'express';
import { injectable } from 'tsyringe';
import { CategoryService } from '@services/CategoryService';
import { AppError } from '@utils/errors';

@injectable()
export class AdminCategoryController {
  constructor(private categoryService: CategoryService) {}

  getAllCategories = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const categories = await this.categoryService.getAllCategories();
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
      const category = await this.categoryService.getCategoryById(id);

      if (!category) {
        throw new AppError('Không tìm thấy thể loại', 404);
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
        message: 'Tạo thể loại thành công',
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
        throw new AppError('Không tìm thấy thể loại', 404);
      }

      res.status(200).json({
        success: true,
        message: 'Cập nhật thể loại thành công',
        data: updatedCategory,
      });
    } catch (error) {
      next(error);
    }
  };

  deleteCategory = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      const success = await this.categoryService.deleteCategory(id);

      if (!success) {
        throw new AppError('Không tìm thấy thể loại để xóa', 404);
      }

      res.status(200).json({
        success: true,
        message: 'Xóa thể loại thành công',
      });
    } catch (error) {
      next(error);
    }
  };
}
