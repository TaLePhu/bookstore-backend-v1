import { Book } from '@entities/Book';

export interface BookResponse extends Book {
  rating: number;
  totalReviews: number;
}
