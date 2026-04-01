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
import { User } from './User';
import { Book } from './Book';

export enum BehaviorType {
  VIEW = 'VIEW',
  CLICK = 'CLICK',
  ADD_TO_CART = 'ADD_TO_CART',
  PURCHASE = 'PURCHASE',
  WISHLIST = 'WISHLIST',
}

@Entity('user_behaviors')
@Index(['userId', 'createdAt'])
export class UserBehavior {
  @PrimaryColumn('uuid')
  id: string = uuidv4();

  @Column('enum', { enum: BehaviorType })
  behaviorType: BehaviorType;

  @CreateDateColumn()
  createdAt: Date;

  // Relations
  @ManyToOne(() => User, (user) => user.behaviors, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column('uuid')
  userId: string;

  @ManyToOne(() => Book, (book) => book.userBehaviors, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'book_id' })
  book: Book;

  @Column('uuid')
  bookId: string = '';
}
