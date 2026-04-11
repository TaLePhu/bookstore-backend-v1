import {
  IsNotEmpty,
  IsUUID,
  IsOptional,
  IsNumber,
  Min,
  IsString,
  MaxLength,
} from 'class-validator';

export class CreateOrderDto {
  @IsNotEmpty({ message: 'addressId không được để trống' })
  @IsUUID('4', { message: 'addressId phải là UUID hợp lệ' })
  addressId: string;

  @IsOptional()
  @IsNumber({}, { message: 'shippingFee phải là số' })
  @Min(0, { message: 'shippingFee không được âm' })
  shippingFee?: number;

  @IsOptional()
  @IsString({ message: 'note phải là chuỗi' })
  @MaxLength(500, { message: 'note tối đa 500 ký tự' })
  note?: string;
}
