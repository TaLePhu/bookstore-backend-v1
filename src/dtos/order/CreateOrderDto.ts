import {
  IsNotEmpty,
  IsUUID,
  IsOptional,
  IsNumber,
  Min,
  IsString,
  MaxLength,
  IsArray,
  IsEnum
} from 'class-validator';
import { PaymentMethod } from '@entities/Payment';

export class CreateOrderDto {
  @IsOptional()
  @IsUUID('4', { message: 'addressId phải là UUID hợp lệ' })
  addressId?: string;

  // Partial checkout
  @IsOptional()
  @IsArray({ message: 'cartItemIds phải là mảng' })
  @IsUUID('4', { each: true, message: 'Mỗi cartItemId phải là UUID hợp lệ' })
  cartItemIds?: string[];

  // Inline address info (used if addressId is not provided)
  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  provinceCode?: string;

  @IsOptional()
  @IsString()
  provinceName?: string;

  @IsOptional()
  @IsString()
  districtCode?: string;

  @IsOptional()
  @IsString()
  districtName?: string;

  @IsOptional()
  @IsString()
  wardCode?: string;

  @IsOptional()
  @IsString()
  wardName?: string;

  @IsOptional()
  @IsString()
  addressLine?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  receiverName?: string;

  @IsOptional()
  @IsEnum(PaymentMethod, { message: 'paymentMethod không hợp lệ' })
  paymentMethod?: PaymentMethod;

  @IsOptional()
  @IsNumber({}, { message: 'shippingFee phải là số' })
  @Min(0, { message: 'shippingFee không được âm' })
  shippingFee?: number;

  @IsOptional()
  @IsString({ message: 'note phải là chuỗi' })
  @MaxLength(500, { message: 'note tối đa 500 ký tự' })
  note?: string;
}
