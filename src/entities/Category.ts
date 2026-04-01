import { Entity, PrimaryColumn, Column, CreateDateColumn, OneToMany } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Book } from './Book';

@Entity('categories')
export class Category {
  @PrimaryColumn('uuid')
  id: string = uuidv4();

  @Column('varchar', { length: 255, unique: true })
  name: string;

  @Column('text')
  description: string;

  @CreateDateColumn()
  createdAt: Date;

  // Relations
  @OneToMany(() => Book, (book) => book.category, { cascade: true })
  books: Book[];
}
