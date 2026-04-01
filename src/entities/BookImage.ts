import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Book } from './Book';

@Entity('book_images')
export class BookImage {
  @PrimaryColumn('uuid')
  id: string = uuidv4();

  @Column('varchar', { length: 500 })
  url: string;

  @Column('boolean', { default: false })
  isPrimary: boolean;

  @CreateDateColumn()
  createdAt: Date;

  // Relations
  @ManyToOne(() => Book, (book) => book.images, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'book_id' })
  book: Book;

  @Column('uuid')
  bookId: string;
}
