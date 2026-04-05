import { injectable, inject } from 'tsyringe';
import { IBookRepository } from '@repositories/interfaces/IBookRepository';
import { TOKENS } from '@config/container';
import { NotFoundError } from '@utils/errors';
import { Book } from '@entities/Book';

@injectable()
export class BookService {
  constructor(@inject(TOKENS.BOOK_REPOSITORY) private bookRepository: IBookRepository) {}

  async getAllBooks(page: number = 1, limit: number = 10): Promise<{ data: Book[]; total: number; page: number; limit: number }> {
    const { data, total } = await this.bookRepository.findAll(page, limit);
    return { data, total, page, limit };
  }

  async getBookById(id: string): Promise<Book> {
    const book = await this.bookRepository.findById(id);
    if (!book) {
      throw new NotFoundError('Sách này không được tìm thấy (Book not found)');
    }
    return book;
  }

  async searchBooks(query: string, page: number = 1, limit: number = 10): Promise<{ data: Book[]; total: number; page: number; limit: number }> {
    if (!query || query.trim() === '') {
      return { data: [], total: 0, page, limit };
    }
    const { data, total } = await this.bookRepository.search(query, page, limit);
    return { data, total, page, limit };
  }
}
