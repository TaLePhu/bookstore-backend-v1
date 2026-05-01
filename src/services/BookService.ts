import { injectable, inject } from 'tsyringe';
import { IBookRepository, BookListOptions } from '@repositories/interfaces/IBookRepository';
import { ICategoryRepository } from '@repositories/interfaces/ICategoryRepository';
import { TOKENS } from '@config/container';
import { NotFoundError } from '@utils/errors';
import { BookResponse } from '@dtos/book/BookResponseDto';

@injectable()
export class BookService {
  constructor(
    @inject(TOKENS.BOOK_REPOSITORY) private bookRepository: IBookRepository,
    @inject(TOKENS.CATEGORY_REPOSITORY) private categoryRepository: ICategoryRepository
  ) {}

  async getAllBooks(options: BookListOptions): Promise<{ data: BookResponse[]; total: number; page: number; limit: number }> {
    const { page, limit, sort, categoryId } = options;

    if (categoryId) {
      const category = await this.categoryRepository.findById(categoryId);
      if (!category) {
        throw new NotFoundError('Danh mục không tồn tại (Category not found)');
      }
    }

    const { data, total } = await this.bookRepository.findAllWithFilters({
      page,
      limit,
      sort,
      categoryId
    });
    return { data, total, page, limit };
  }

  async getBookById(id: string): Promise<BookResponse> {
    const book = await this.bookRepository.findById(id);
    if (!book) {
      throw new NotFoundError('Sách này không được tìm thấy (Book not found)');
    }
    return book;
  }

  async searchBooks(query: string, page: number = 1, limit: number = 10): Promise<{ data: BookResponse[]; total: number; page: number; limit: number }> {
    if (!query || query.trim() === '') {
      return { data: [], total: 0, page, limit };
    }
    const { data, total } = await this.bookRepository.search(query, page, limit);
    return { data, total, page, limit };
  }
}

