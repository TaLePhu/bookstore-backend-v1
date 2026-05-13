import {
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  Unique,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Book } from './Book';
import { Promotion } from './Promotion';

@Entity('promotion_books')
@Unique(['promotionId', 'bookId'])
export class PromotionBook {
  @PrimaryColumn('uuid')
  id: string = uuidv4();

  @Column('uuid')
  promotionId: string;

  @Column('uuid')
  bookId: string;

  @ManyToOne(() => Promotion, (promotion) => promotion.promotionBooks, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'promotion_id' })
  promotion: Promotion;

  @ManyToOne(() => Book, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'book_id' })
  book: Book;

  @CreateDateColumn()
  createdAt: Date;
}
