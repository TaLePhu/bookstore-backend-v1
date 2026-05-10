import { Book } from '@entities/Book';

export interface BookResponse extends Book {
  image?: string;
  rating: number;
  totalReviews: number;
  status?: 'in_stock' | 'out_of_stock' | 'deleted';
}
