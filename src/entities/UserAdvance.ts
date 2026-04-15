import { Entity, PrimaryColumn, Column, OneToOne, JoinColumn, CreateDateColumn, UpdateDateColumn } from 'typeorm';
import { User } from './User';
import { v4 as uuidv4 } from 'uuid';

@Entity('user_advances')
export class UserAdvance {
  @PrimaryColumn('uuid')
  id: string = uuidv4();

  @Column('varchar', { length: 255, nullable: true })
  avatar: string;

  @Column('date', { nullable: true })
  dob: Date;

  @Column('varchar', { length: 20, nullable: true })
  gender: string;

  @Column('varchar', { length: 20, nullable: true })
  phone: string;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @OneToOne(() => User, (user) => user.userAdvance, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column('uuid')
  userId: string;
}
