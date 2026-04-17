import { Entity, PrimaryColumn, Column, CreateDateColumn, ManyToOne, JoinColumn } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { User } from './User';

@Entity('addresses')
export class Address {
  @PrimaryColumn('uuid')
  id: string = uuidv4();

  @Column('varchar', { length: 255 })
  receiverName: string;

  @Column('varchar', { length: 20 })
  phone: string;

  @Column('varchar', { length: 500 })
  addressLine: string;

  @Column('varchar', { length: 100, default: 'Việt Nam' })
  country: string;

  @Column('varchar', { length: 50, nullable: true })
  provinceCode: string;

  @Column('varchar', { length: 100, nullable: true })
  provinceName: string;

  @Column('varchar', { length: 50, nullable: true })
  districtCode: string;

  @Column('varchar', { length: 100, nullable: true })
  districtName: string;

  @Column('varchar', { length: 50, nullable: true })
  wardCode: string;

  @Column('varchar', { length: 100, nullable: true })
  wardName: string;

  @Column('boolean', { name: 'is_default', default: false })
  isDefault: boolean;

  @CreateDateColumn()
  createdAt: Date;

  // Relations
  @ManyToOne(() => User, (user) => user.addresses, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column('uuid')
  userId: string;
}
