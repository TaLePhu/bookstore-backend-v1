import { User } from '@entities/User';

export interface IUserRepository {
  findById(id: string, relations?: string[]): Promise<User | null>;
  findByEmail(email: string): Promise<User | null>;
  create(user: Partial<User>): Promise<User>;
  update(id: string, data: Partial<User>): Promise<User | null>;
  delete(id: string): Promise<boolean>;
}
