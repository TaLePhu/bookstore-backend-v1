import { Request, Response } from 'express';
import { injectable } from 'tsyringe';
import { AddressService } from '@services/AddressService';
import { CreateAddressDto } from '@dtos/address/CreateAddressDto';
import { UpdateAddressDto } from '@dtos/address/UpdateAddressDto';
import { asyncWrapper } from '@utils/async-wrapper';
import { sendError, sendSuccess } from '@utils/response';

@injectable()
export class AddressController {
  constructor(private addressService: AddressService) {}

  createAddress = asyncWrapper(async (req: Request, res: Response) => {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return sendError(res, 'Unauthorized', 401);
    }

    const dto: CreateAddressDto = req.body;
    const address = await this.addressService.createAddress(userId, dto);
    return sendSuccess(res, address, 'Tạo địa chỉ thành công', 201);
  });

  getMyAddresses = asyncWrapper(async (req: Request, res: Response) => {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return sendError(res, 'Unauthorized', 401);
    }

    const addresses = await this.addressService.getMyAddresses(userId);
    return sendSuccess(res, addresses, 'Lấy danh sách địa chỉ thành công');
  });

  getAddressById = asyncWrapper(async (req: Request, res: Response) => {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return sendError(res, 'Unauthorized', 401);
    }

    const address = await this.addressService.getAddressById(userId, req.params.id);
    return sendSuccess(res, address, 'Lấy địa chỉ thành công');
  });

  updateAddress = asyncWrapper(async (req: Request, res: Response) => {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return sendError(res, 'Unauthorized', 401);
    }

    const dto: UpdateAddressDto = req.body;
    const address = await this.addressService.updateAddress(userId, req.params.id, dto);
    return sendSuccess(res, address, 'Cập nhật địa chỉ thành công');
  });

  deleteAddress = asyncWrapper(async (req: Request, res: Response) => {
    const userId = (req as any).user?.userId;
    if (!userId) {
      return sendError(res, 'Unauthorized', 401);
    }

    await this.addressService.deleteAddress(userId, req.params.id);
    return sendSuccess(res, null, 'Xóa địa chỉ thành công');
  });
}
