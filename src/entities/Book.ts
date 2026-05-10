import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  DeleteDateColumn,
  OneToMany,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Category } from './Category';
import { Review } from './Review';
import { BookImage } from './BookImage';
import { Embedding } from './Embedding';
import { CartItem } from './CartItem';
import { OrderItem } from './OrderItem';
import { UserBehavior } from './UserBehavior';

@Entity('books')
export class Book {
  @PrimaryColumn('uuid')
  id: string = uuidv4();

  @Column('varchar', { length: 255 })
  title: string;

  @Column('varchar', { length: 255 })
  author: string;

  @Column('text')
  description: string;

  @Column('decimal', { precision: 10, scale: 2 })
  price: number;

  @Column('integer')
  stock: number;

  @Column('integer', { default: 0 })
  soldCount: number;

  @Column('varchar', { name: 'isbn', length: 20, unique: true })
  isbn: string;

  @Column('varchar', { length: 255, nullable: true })
  translator: string;

  @Column('varchar', { length: 255, nullable: true })
  publisher: string;

  @Column('integer', { nullable: true })
  publishYear: number;

  @Column('integer', { nullable: true })
  pages: number;

  @Column('varchar', { length: 255, nullable: true })
  dimensions: string;

  @Column('varchar', { length: 255, nullable: true })
  weight: string;

  @Column('varchar', { length: 255, nullable: true })
  format: string;

  @Column('varchar', { length: 255, nullable: true })
  language: string;

  @Column('decimal', { precision: 10, scale: 2, nullable: true })
  originalPrice: number;

  @Column('integer', { nullable: true })
  discount: number;

  @Column('simple-array', { nullable: true })
  highlights: string[];

  @Column('date', { nullable: true })
  releaseDate: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at', nullable: true })
  deletedAt: Date | null;

  // Relations
  @ManyToOne(() => Category, (category) => category.books, { nullable: false })
  @JoinColumn({ name: 'category_id' })
  category: Category;

  @Column('uuid')
  categoryId: string;

  @OneToMany(() => Review, (review) => review.book, { cascade: true })
  reviews: Review[];

  @OneToMany(() => BookImage, (image) => image.book, { cascade: true })
  images: BookImage[];

  @OneToMany(() => Embedding, (embedding) => embedding.book, { cascade: true })
  embeddings: Embedding[];

  @OneToMany(() => CartItem, (item) => item.book)
  cartItems: CartItem[];

  @OneToMany(() => OrderItem, (item) => item.book)
  orderItems: OrderItem[];

  @OneToMany(() => UserBehavior, (behavior) => behavior.book)
  userBehaviors: UserBehavior[];
}
