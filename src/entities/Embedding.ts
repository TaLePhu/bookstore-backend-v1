import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Book } from './Book';

@Entity('embeddings')
@Index(['book_id'])
export class Embedding {
  @PrimaryColumn('uuid')
  id: string = uuidv4();

  @Column('vector', { length: 1536, nullable: true })
  vector: string | null;

  @CreateDateColumn()
  createdAt: Date;

  // Relations
  @ManyToOne(() => Book, (book) => book.embeddings, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'book_id' })
  book: Book;

  @Column('uuid')
  bookId: string;
}
