import { EntityManager } from 'typeorm';
import { Address } from '@entities/Address';

export interface IAddressRepository {
  findByUserId(userId: string): Promise<Address[]>;
  findByIdAndUserId(addressId: string, userId: string): Promise<Address | null>;
  countByUserId(userId: string): Promise<number>;
  findDefaultByUserId(userId: string): Promise<Address | null>;
  unsetDefaultByUserId(userId: string, manager?: EntityManager): Promise<void>;
  create(addressData: Partial<Address>, manager?: EntityManager): Promise<Address>;
  update(address: Address, manager?: EntityManager): Promise<Address>;
  delete(addressId: string, manager?: EntityManager): Promise<boolean>;
}
