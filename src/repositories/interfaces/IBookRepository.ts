import { BookResponse } from '@dtos/book/BookResponseDto';
import { Book } from '@entities/Book';

export type BookListSort = 'latest' | 'bestseller';

export interface BookListOptions {
  page: number;
  limit: number;
  sort?: BookListSort;
  categoryId?: string;
  status?: 'in_stock' | 'out_of_stock';
}

export interface IBookRepository {
  findAll(page: number, limit: number): Promise<{ data: BookResponse[]; total: number }>;
  findAllWithFilters(options: BookListOptions): Promise<{ data: BookResponse[]; total: number }>;
  findById(id: string): Promise<BookResponse | null>;
  search(query: string, page: number, limit: number): Promise<{ data: BookResponse[]; total: number }>;
  searchKeywordExtended(query: string, page: number, limit: number): Promise<{ data: BookResponse[]; total: number }>;
  searchKeywordIds(query: string, limit: number): Promise<string[]>;
  findByIdsPreserveOrder(ids: string[]): Promise<BookResponse[]>;
  create(
    book: Partial<Book>,
    images: { url: string; publicId?: string | null; isPrimary?: boolean }[]
  ): Promise<Book>;
  update(
    id: string,
    book: Partial<Book>,
    images?: { url: string; publicId?: string | null; isPrimary?: boolean }[]
  ): Promise<Book | null>;
}
