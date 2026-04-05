import { Book } from '@entities/Book';

export interface IBookRepository {
  findAll(page: number, limit: number): Promise<{ data: Book[]; total: number }>;
  findById(id: string): Promise<Book | null>;
  search(query: string, page: number, limit: number): Promise<{ data: Book[]; total: number }>;
}
