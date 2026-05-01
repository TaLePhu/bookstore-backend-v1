import { BookResponse } from '@dtos/book/BookResponseDto';

export type BookListSort = 'latest' | 'bestseller';

export interface BookListOptions {
  page: number;
  limit: number;
  sort?: BookListSort;
  categoryId?: string;
}

export interface IBookRepository {
  findAll(page: number, limit: number): Promise<{ data: BookResponse[]; total: number }>;
  findAllWithFilters(options: BookListOptions): Promise<{ data: BookResponse[]; total: number }>;
  findById(id: string): Promise<BookResponse | null>;
  search(query: string, page: number, limit: number): Promise<{ data: BookResponse[]; total: number }>;
}
