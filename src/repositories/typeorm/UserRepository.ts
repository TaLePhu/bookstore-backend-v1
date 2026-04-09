import { Repository } from 'typeorm';
import { User } from '@entities/User';
import { AppDataSource } from '@config/data-source';
import { IUserRepository } from '@repositories/interfaces/IUserRepository';
import { NotFoundError } from '@utils/errors';

export class UserRepository implements IUserRepository {
  private repository: Repository<User>;

  constructor() {
    this.repository = AppDataSource.getRepository(User);
  }

  async findById(id: string, relations?: string[]): Promise<User | null> {
    return this.repository.findOne({
      where: { id },
      relations: relations || [],
    });
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.repository.createQueryBuilder('user')
      .where('user.email = :email', { email })
      .addSelect('user.passwordHash')
      .getOne();
  }

  async create(userData: Partial<User>): Promise<User> {
    const user = this.repository.create(userData);
    return this.repository.save(user);
  }

  async update(id: string, data: Partial<User>): Promise<User | null> {
    const user = await this.findById(id);
    if (!user) {
      throw new NotFoundError('User not found');
    }
    Object.assign(user, data);
    return this.repository.save(user);
  }

  async delete(id: string): Promise<boolean> {
    const result = await this.repository.delete(id);
    return (result.affected ?? 0) > 0;
  }
}
