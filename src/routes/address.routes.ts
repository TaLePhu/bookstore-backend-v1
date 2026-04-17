import { Router } from 'express';
import { container } from 'tsyringe';
import { AddressController } from '@controllers/AddressController';
import { authMiddleware } from '@middlewares/auth.middleware';
import { validateDto } from '@middlewares/validate.middleware';
import { CreateAddressDto } from '@dtos/address/CreateAddressDto';
import { UpdateAddressDto } from '@dtos/address/UpdateAddressDto';

const router = Router();
const addressController = container.resolve(AddressController);

router.use(authMiddleware);

router.post('/', validateDto(CreateAddressDto), addressController.createAddress);
router.get('/', addressController.getMyAddresses);
router.get('/:id', addressController.getAddressById);
router.patch('/:id', validateDto(UpdateAddressDto), addressController.updateAddress);
router.delete('/:id', addressController.deleteAddress);

export default router;
