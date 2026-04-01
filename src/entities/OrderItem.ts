import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Order } from './Order';
import { Book } from './Book';

@Entity('order_items')
export class OrderItem {
  @PrimaryColumn('uuid')
  id: string = uuidv4();

  @Column('integer')
  quantity: number;

  @Column('decimal', { precision: 15, scale: 2 })
  price: number;

  @CreateDateColumn()
  createdAt: Date;

  // Relations
  @ManyToOne(() => Order, (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column('uuid')
  orderId: string;

  @ManyToOne(() => Book, (book) => book.orderItems, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'book_id' })
  book: Book;

  @Column('uuid')
  bookId: string;
}
