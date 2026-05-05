import { Request, Response, NextFunction } from 'express';
import { injectable } from 'tsyringe';
import { BookService } from '@services/BookService';
import { AppError } from '@utils/errors';

function getSafePagination(pageValue: unknown, limitValue: unknown): { page: number; limit: number } {
  const parsedPage = parseInt(String(pageValue ?? ''), 10);
  const parsedLimit = parseInt(String(limitValue ?? ''), 10);

  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const limit = Number.isFinite(parsedLimit) ? Math.min(50, Math.max(1, parsedLimit)) : 10;

  return { page, limit };
}

function isUuid(value: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
  return uuidRegex.test(value);
}

@injectable()
export class AdminBookController {
  constructor(private bookService: BookService) {}

  getAllBooks = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { page, limit } = getSafePagination(req.query.page, req.query.limit);
      const rawSort = typeof req.query.sort === 'string' ? req.query.sort.trim().toLowerCase() : '';
      const sort = rawSort === '' ? undefined : rawSort;
      const categoryId = typeof req.query.category_id === 'string' ? req.query.category_id.trim() : undefined;
      const rawStatus = typeof req.query.status === 'string' ? req.query.status.trim().toLowerCase() : '';
      const status = (rawStatus === 'in_stock' || rawStatus === 'out_of_stock') ? rawStatus : undefined;

      if (sort && sort !== 'latest' && sort !== 'bestseller') {
        throw new AppError('Lỗi: sort không hợp lệ. Chỉ hỗ trợ latest | bestseller.', 400);
      }

      if (categoryId && !isUuid(categoryId)) {
        throw new AppError('Lỗi: category_id không đúng định dạng UUID.', 400);
      }

      const result = await this.bookService.getAllBooks({
        page,
        limit,
        sort: sort as 'latest' | 'bestseller' | undefined,
        categoryId,
        status: status as 'in_stock' | 'out_of_stock' | undefined
      });
      
      res.status(200).json({
        success: true,
        data: result.data,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit
        }
      });
    } catch (error) {
      next(error);
    }
  };

  getBookById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;

      if (!isUuid(id)) {
        throw new AppError('Lỗi: ID không đúng định dạng UUID.', 400);
      }

      const book = await this.bookService.getBookById(id);
      
      res.status(200).json({
        success: true,
        data: book
      });
    } catch (error) {
      next(error);
    }
  };

  searchBooks = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const query = req.query.q as string || '';
      const { page, limit } = getSafePagination(req.query.page, req.query.limit);

      const result = await this.bookService.searchBooks(query, page, limit);

      res.status(200).json({
        success: true,
        data: result.data,
        pagination: {
          total: result.total,
          page: result.page,
          limit: result.limit
        }
      });
    } catch (error) {
      next(error);
    }
  };

  createBook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const book = await this.bookService.createBook(req.body);
      res.status(201).json({
        success: true,
        message: 'Tạo sách mới thành công',
        data: book,
      });
    } catch (error) {
      next(error);
    }
  };

  updateBook = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { id } = req.params;
      
      if (!isUuid(id)) {
        throw new AppError('Lỗi: ID không đúng định dạng UUID.', 400);
      }

      const book = await this.bookService.updateBook(id, req.body);
      res.status(200).json({
        success: true,
        message: 'Cập nhật sách thành công',
        data: book,
      });
    } catch (error) {
      next(error);
    }
  };
}
