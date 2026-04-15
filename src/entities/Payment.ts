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

export enum PaymentMethod {
  CREDIT_CARD = 'CREDIT_CARD',
  DEBIT_CARD = 'DEBIT_CARD',
  BANK_TRANSFER = 'BANK_TRANSFER',
  WALLET = 'WALLET',
  COD = 'COD',
}

export enum PaymentStatus {
  PENDING = 'PENDING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED',
  REFUNDED = 'REFUNDED',
}

@Entity('payments')
export class Payment {
  @PrimaryColumn('uuid')
  id: string = uuidv4();

  @Column('decimal', { precision: 15, scale: 2 })
  amount: number;

  @Column('enum', { enum: PaymentMethod })
  method: PaymentMethod;

  @Column('enum', { enum: PaymentStatus, default: PaymentStatus.PENDING })
  status: PaymentStatus;

  @CreateDateColumn()
  createdAt: Date;

  // Relations
  @ManyToOne(() => Order, (order) => order.payments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column('uuid')
  orderId: string;
}
