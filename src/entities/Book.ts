import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
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

  @Column('varchar', { length: 20, unique: true })
  ISBN: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

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
