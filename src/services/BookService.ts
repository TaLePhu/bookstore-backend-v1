import { injectable, inject } from 'tsyringe';
import { IBookRepository, BookListOptions } from '@repositories/interfaces/IBookRepository';
import { ICategoryRepository } from '@repositories/interfaces/ICategoryRepository';
import { TOKENS } from '@config/container';
import { NotFoundError } from '@utils/errors';
import { BookResponse } from '@dtos/book/BookResponseDto';
import redisConfig from '@config/redis';
import { CreateBookDto } from '@dtos/book/CreateBookDto';
import { UpdateBookDto } from '@dtos/book/UpdateBookDto';
import { Book } from '@entities/Book';

@injectable()
export class BookService {
  constructor(
    @inject(TOKENS.BOOK_REPOSITORY) private bookRepository: IBookRepository,
    @inject(TOKENS.CATEGORY_REPOSITORY) private categoryRepository: ICategoryRepository
  ) {}

  async getAllBooks(options: BookListOptions): Promise<{ data: BookResponse[]; total: number; page: number; limit: number }> {
    const { page, limit, sort, categoryId, status } = options;

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
      categoryId,
      status
    });
    return { data, total, page, limit };
  }

  async getBookById(id: string): Promise<BookResponse> {
    const cacheKey = `book:detail:${id}`;

    // 1. Kiểm tra cache
    const cachedData = await redisConfig.get(cacheKey);
    if (cachedData) {
      return JSON.parse(cachedData) as BookResponse;
    }

    // 2. Nếu miss cache, gọi DB
    const book = await this.bookRepository.findById(id);
    if (!book) {
      throw new NotFoundError('Sách này không được tìm thấy (Book not found)');
    }

    // 3. Set cache với TTL = 1 giờ
    await redisConfig.set(cacheKey, JSON.stringify(book), 'EX', 3600);

    return book;
  }

  async searchBooks(query: string, page: number = 1, limit: number = 10): Promise<{ data: BookResponse[]; total: number; page: number; limit: number }> {
    if (!query || query.trim() === '') {
      return { data: [], total: 0, page, limit };
    }
    const { data, total } = await this.bookRepository.search(query, page, limit);
    return { data, total, page, limit };
  }

  async createBook(dto: CreateBookDto): Promise<any> {
    if (dto.categoryId) {
      const category = await this.categoryRepository.findById(dto.categoryId);
      if (!category) {
        throw new NotFoundError('Danh mục không tồn tại');
      }
    }

    const { images, releaseDate, ...rest } = dto;
    const bookData: Partial<Book> = { ...rest };
    if (releaseDate) {
      bookData.releaseDate = new Date(releaseDate);
    }
    return this.bookRepository.create(bookData, images);
  }

  async updateBook(id: string, dto: UpdateBookDto): Promise<any> {
    if (dto.categoryId) {
      const category = await this.categoryRepository.findById(dto.categoryId);
      if (!category) {
        throw new NotFoundError('Danh mục không tồn tại');
      }
    }

    const { images, releaseDate, ...rest } = dto;
    const bookData: Partial<Book> = { ...rest };
    if (releaseDate) {
      bookData.releaseDate = new Date(releaseDate);
    }
    const updatedBook = await this.bookRepository.update(id, bookData, images);

    if (!updatedBook) {
      throw new NotFoundError('Sách không tồn tại');
    }

    // Xóa cache detail sau khi update
    await redisConfig.del(`book:detail:${id}`);

    return updatedBook;
  }
}

