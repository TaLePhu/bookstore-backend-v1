import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  OneToMany,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';

export enum OrderStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  SHIPPED = 'SHIPPED',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

import { User } from './User';
import { Address } from './Address';
import { OrderItem } from './OrderItem';
import { Payment } from './Payment';

@Entity('orders')
export class Order {
  @PrimaryColumn('uuid')
  id: string = uuidv4();

  @Column('decimal', { precision: 15, scale: 2 })
  totalAmount: number;

  @Column('decimal', { precision: 15, scale: 2, default: 0 })
  shippingFee: number;

  @Column('text', { nullable: true })
  note: string | null;

  @Column('enum', { enum: OrderStatus, default: OrderStatus.PENDING })
  status: OrderStatus;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => User, (user) => user.orders, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column('uuid')
  userId: string;

  @ManyToOne(() => Address, { nullable: true })
  @JoinColumn({ name: 'address_id' })
  address: Address;

  @Column('uuid', { nullable: true })
  addressId: string;

  @OneToMany(() => OrderItem, (item) => item.order, { cascade: true })
  items: OrderItem[];

  @OneToMany(() => Payment, (payment) => payment.order, { cascade: true })
  payments: Payment[];
}
