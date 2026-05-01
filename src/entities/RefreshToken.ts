import {
  Entity,
  PrimaryColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  JoinColumn,
  Index,
} from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { User } from './User';

@Entity('refresh_tokens')
@Index(['userId', 'deviceId', 'createdAt'])
export class RefreshToken {
  @PrimaryColumn('uuid')
  id: string = uuidv4();

  @Column('text')
  token: string;

  @Column('uuid', { name: 'device_id', nullable: true })
  deviceId: string | null;

  @Column('timestamp')
  expiresAt: Date;

  @Column('boolean', { default: false })
  isRevoked: boolean;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  // Relations
  @ManyToOne(() => User, (user) => user.refreshTokens, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @Column('uuid', { name: 'user_id' })
  userId: string;
}
