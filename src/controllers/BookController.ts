import { Request, Response, NextFunction } from 'express';
import { injectable } from 'tsyringe';
import { BookService } from '@services/BookService';

function getSafePagination(pageValue: unknown, limitValue: unknown): { page: number; limit: number } {
  const parsedPage = parseInt(String(pageValue ?? ''), 10);
  const parsedLimit = parseInt(String(limitValue ?? ''), 10);

  const page = Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const limit = Number.isFinite(parsedLimit) ? Math.min(50, Math.max(1, parsedLimit)) : 10;

  return { page, limit };
}

@injectable()
export class BookController {
  constructor(private bookService: BookService) {}

  getAllBooks = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    try {
      const { page, limit } = getSafePagination(req.query.page, req.query.limit);

      const result = await this.bookService.getAllBooks(page, limit);
      
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
      
      // Sử dụng Regex cơ bản thay vì thư viện 'uuid' vì Postgres cho phép các định dạng UUID linh hoạt hơn (không nhất thiết phải chuẩn RFC 4122)
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(id)) {
        res.status(400).json({
          success: false,
          message: 'Lỗi: ID không đúng định dạng UUID.'
        });
        return;
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
      // Nhận query string từ URL (ví dụ: ?q=...)
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
}
