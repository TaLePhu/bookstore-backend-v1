import {
  Column,
  CreateDateColumn,
  Entity,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { PromotionBook } from './PromotionBook';

export enum PromotionStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
}

@Entity('promotions')
export class Promotion {
  @PrimaryColumn('uuid')
  id: string = uuidv4();

  @Column('varchar', { length: 255 })
  name: string;

  @Column('text', { nullable: true })
  description: string | null;

  @Column('varchar', { length: 500, nullable: true })
  bannerImageUrl: string | null;

  @Column('varchar', { length: 255, nullable: true })
  bannerImagePublicId: string | null;

  @Column('integer', { default: 0 })
  discountPercent: number;

  @Column('timestamp', { nullable: true })
  startsAt: Date | null;

  @Column('timestamp', { nullable: true })
  endsAt: Date | null;

  @Column('enum', { enum: PromotionStatus, default: PromotionStatus.ACTIVE })
  status: PromotionStatus;

  @OneToMany(() => PromotionBook, (promotionBook) => promotionBook.promotion, { cascade: true })
  promotionBooks: PromotionBook[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}
