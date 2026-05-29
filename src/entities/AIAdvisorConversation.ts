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

@Entity('ai_advisor_conversations')
@Index(['userId', 'updatedAt'])
export class AIAdvisorConversation {
  @PrimaryColumn('uuid')
  id: string = uuidv4();

  @Column('uuid')
  userId: string;

  @Column('varchar', { length: 160 })
  title: string;

  @Column('jsonb')
  messages: unknown[];

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;
}
