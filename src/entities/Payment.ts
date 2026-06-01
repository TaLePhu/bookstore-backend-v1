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
  MOMO = 'MOMO',
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

  @Column('varchar', { length: 50, nullable: true })
  provider: string | null;

  @Column('varchar', { length: 100, nullable: true })
  providerRequestId: string | null;

  @Column('varchar', { length: 200, nullable: true })
  providerOrderId: string | null;

  @Column('varchar', { length: 100, nullable: true })
  providerTransactionId: string | null;

  @Column('text', { nullable: true })
  paymentUrl: string | null;

  @Column('text', { nullable: true })
  qrCodeUrl: string | null;

  @Column('text', { nullable: true })
  deeplink: string | null;

  @Column('jsonb', { nullable: true })
  rawResponse: Record<string, unknown> | null;

  @Column({ type: 'timestamp', nullable: true })
  paidAt: Date | null;

  @CreateDateColumn()
  createdAt: Date;

  // Relations
  @ManyToOne(() => Order, (order) => order.payments, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'order_id' })
  order: Order;

  @Column('uuid')
  orderId: string;
}
