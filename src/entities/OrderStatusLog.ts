import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Order, OrderStatus } from './Order';
import { User } from './User';

@Entity('order_status_logs')
export class OrderStatusLog {
  @PrimaryColumn('uuid')
  id: string = uuidv4();

  @Column('enum', { enum: OrderStatus })
  fromStatus: OrderStatus;

  @Column('enum', { enum: OrderStatus })
  toStatus: OrderStatus;

  @Column('text', { nullable: true })
  note: string | null;

  @CreateDateColumn()
  createdAt: Date;

  @ManyToOne(() => Order, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column('uuid')
  orderId: string;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'changed_by' })
  changedByUser: User | null;

  @Column('uuid', { nullable: true })
  changedBy: string | null;
}
