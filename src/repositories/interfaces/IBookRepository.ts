import { Book } from '@entities/Book';
import { BookResponse } from '@dtos/book/BookResponseDto';

export interface IBookRepository {
  findAll(page: number, limit: number): Promise<{ data: BookResponse[]; total: number }>;
  findById(id: string): Promise<BookResponse | null>;
  search(query: string, page: number, limit: number): Promise<{ data: BookResponse[]; total: number }>;
}
