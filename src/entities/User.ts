import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
  OneToOne,
  Index,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { Address } from './Address';
import { Cart } from './Cart';
import { Order } from './Order';
import { Review } from './Review';
import { UserBehavior } from './UserBehavior';
import { RefreshToken } from './RefreshToken';
import { UserAdvance } from './UserAdvance';

export enum Role {
  GUEST = 'GUEST',
  CUSTOMER = 'CUSTOMER',
  STAFF = 'STAFF',
  ADMIN = 'ADMIN',
}

@Entity('users')
@Index(['email'], { unique: true })
export class User {
  @PrimaryColumn('uuid')
  id: string = uuidv4();

  @Column('varchar', { length: 255, name: 'user_name' })
  userName: string;

  @Column('varchar', { length: 255, nullable: true, name: 'full_name' })
  fullName: string;

  @Column('varchar', { length: 255, unique: true })
  email: string;

  @Column('varchar', { length: 255, select: false })
  passwordHash: string;

  @Column('enum', { enum: Role, default: Role.CUSTOMER })
  role: Role;

  @Column('boolean', { default: false, name: 'is_verified' })
  isVerified: boolean;

  @Column('boolean', { default: false, name: 'is_locked' })
  isLocked: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @OneToMany(() => Address, (address) => address.user, { cascade: true })
  addresses: Address[];

  @OneToMany(() => Cart, (cart) => cart.user, { cascade: true })
  carts: Cart[];

  @OneToMany(() => Order, (order) => order.user, { cascade: true })
  orders: Order[];

  @OneToMany(() => Review, (review) => review.user, { cascade: true })
  reviews: Review[];

  @OneToMany(() => UserBehavior, (behavior) => behavior.user, { cascade: true })
  behaviors: UserBehavior[];

  @OneToMany(() => RefreshToken, (token) => token.user, { cascade: true })
  refreshTokens: RefreshToken[];

  @OneToOne(() => UserAdvance, (userAdvance) => userAdvance.user, { cascade: true })
  userAdvance: UserAdvance;
}
