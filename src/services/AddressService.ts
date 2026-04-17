import { injectable, inject } from 'tsyringe';
import { AppDataSource } from '@config/data-source';
import { TOKENS } from '@config/container';
import { IAddressRepository } from '@repositories/interfaces/IAddressRepository';
import { Address } from '@entities/Address';
import { CreateAddressDto } from '@dtos/address/CreateAddressDto';
import { UpdateAddressDto } from '@dtos/address/UpdateAddressDto';
import { AppError, NotFoundError } from '@utils/errors';

@injectable()
export class AddressService {
  constructor(
    @inject(TOKENS.ADDRESS_REPOSITORY) private addressRepository: IAddressRepository
  ) {}

  async createAddress(userId: string, dto: CreateAddressDto): Promise<Address> {
    const addressCount = await this.addressRepository.countByUserId(userId);
    const shouldSetDefault = addressCount === 0 || dto.isDefault === true;

    return AppDataSource.transaction(async (manager) => {
      if (shouldSetDefault) {
        await this.addressRepository.unsetDefaultByUserId(userId, manager);
      }

      return this.addressRepository.create(
        {
          userId,
          receiverName: dto.receiverName,
          phone: dto.phone,
          addressLine: dto.addressLine,
          country: dto.country,
          provinceCode: dto.provinceCode,
          provinceName: dto.provinceName,
          districtCode: dto.districtCode,
          districtName: dto.districtName,
          wardCode: dto.wardCode,
          wardName: dto.wardName,
          isDefault: shouldSetDefault,
        },
        manager
      );
    });
  }

  async getMyAddresses(userId: string): Promise<Address[]> {
    return this.addressRepository.findByUserId(userId);
  }

  async getAddressById(userId: string, addressId: string): Promise<Address> {
    const address = await this.addressRepository.findByIdAndUserId(addressId, userId);
    if (!address) {
      throw new NotFoundError('Địa chỉ không tồn tại');
    }

    return address;
  }

  async updateAddress(userId: string, addressId: string, dto: UpdateAddressDto): Promise<Address> {
    const existingAddress = await this.addressRepository.findByIdAndUserId(addressId, userId);
    if (!existingAddress) {
      throw new NotFoundError('Địa chỉ không tồn tại');
    }

    return AppDataSource.transaction(async (manager) => {
      if (dto.isDefault === true) {
        await this.addressRepository.unsetDefaultByUserId(userId, manager);
        existingAddress.isDefault = true;
      } else if (dto.isDefault === false && existingAddress.isDefault) {
        throw new AppError('Không thể bỏ mặc định của địa chỉ hiện tại. Vui lòng chọn địa chỉ khác làm mặc định trước.', 400);
      }

      existingAddress.receiverName = dto.receiverName;
      existingAddress.phone = dto.phone;
      existingAddress.addressLine = dto.addressLine;
      existingAddress.country = dto.country;
      existingAddress.provinceCode = dto.provinceCode;
      existingAddress.provinceName = dto.provinceName;
      existingAddress.districtCode = dto.districtCode;
      existingAddress.districtName = dto.districtName;
      existingAddress.wardCode = dto.wardCode;
      existingAddress.wardName = dto.wardName;

      return this.addressRepository.update(existingAddress, manager);
    });
  }

  async deleteAddress(userId: string, addressId: string): Promise<void> {
    const existingAddress = await this.addressRepository.findByIdAndUserId(addressId, userId);
    if (!existingAddress) {
      throw new NotFoundError('Địa chỉ không tồn tại');
    }

    if (existingAddress.isDefault) {
      throw new AppError('Không thể xóa địa chỉ mặc định', 400);
    }

    const addressCount = await this.addressRepository.countByUserId(userId);
    if (addressCount <= 1) {
      throw new AppError('Bạn phải giữ ít nhất một địa chỉ giao hàng', 400);
    }

    await this.addressRepository.delete(addressId);
  }
}
