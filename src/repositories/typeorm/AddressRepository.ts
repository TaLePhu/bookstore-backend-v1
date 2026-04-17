import { EntityManager, Repository } from 'typeorm';
import { AppDataSource } from '@config/data-source';
import { Address } from '@entities/Address';
import { IAddressRepository } from '@repositories/interfaces/IAddressRepository';

export class AddressRepository implements IAddressRepository {
  private repository: Repository<Address>;

  constructor() {
    this.repository = AppDataSource.getRepository(Address);
  }

  async findByUserId(userId: string): Promise<Address[]> {
    return this.repository.find({
      where: { userId },
      order: { isDefault: 'DESC', createdAt: 'DESC' },
    });
  }

  async findByIdAndUserId(addressId: string, userId: string): Promise<Address | null> {
    return this.repository.findOne({ where: { id: addressId, userId } });
  }

  async countByUserId(userId: string): Promise<number> {
    return this.repository.count({ where: { userId } });
  }

  async findDefaultByUserId(userId: string): Promise<Address | null> {
    return this.repository.findOne({ where: { userId, isDefault: true } });
  }

  async unsetDefaultByUserId(userId: string, manager?: EntityManager): Promise<void> {
    const repo = manager ? manager.getRepository(Address) : this.repository;
    await repo
      .createQueryBuilder()
      .update(Address)
      .set({ isDefault: false })
      .where('user_id = :userId', { userId })
      .andWhere('is_default = true')
      .execute();
  }

  async create(addressData: Partial<Address>, manager?: EntityManager): Promise<Address> {
    const repo = manager ? manager.getRepository(Address) : this.repository;
    const address = repo.create(addressData);
    return repo.save(address);
  }

  async update(address: Address, manager?: EntityManager): Promise<Address> {
    const repo = manager ? manager.getRepository(Address) : this.repository;
    return repo.save(address);
  }

  async delete(addressId: string, manager?: EntityManager): Promise<boolean> {
    const repo = manager ? manager.getRepository(Address) : this.repository;
    const result = await repo.delete(addressId);
    return (result.affected ?? 0) > 0;
  }
}
