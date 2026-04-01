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
import { Cart } from './Cart';
import { Book } from './Book';

@Entity('cart_items')
@Index(['cartId', 'bookId'], { unique: true })
export class CartItem {
  @PrimaryColumn('uuid')
  id: string = uuidv4();

  @Column('integer')
  quantity: number;

  @CreateDateColumn()
  createdAt: Date;

  // Relations
  @ManyToOne(() => Cart, (cart) => cart.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'cart_id' })
  cart: Cart;

  @Column('uuid')
  cartId: string;

  @ManyToOne(() => Book, (book) => book.cartItems, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'book_id' })
  book: Book;

  @Column('uuid')
  bookId: string;
}
