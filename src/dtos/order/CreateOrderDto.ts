import {
  IsNotEmpty,
  IsUUID,
  IsOptional,
  IsNumber,
  Min,
  IsString,
  MaxLength,
  IsArray,
  IsEnum,
  ValidateIf
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
  @ValidateIf((o) => !o.addressId)
  @IsNotEmpty({ message: 'country không được để trống khi không chọn địa chỉ có sẵn' })
  @IsString()
  country?: string;

  @ValidateIf((o) => !o.addressId)
  @IsNotEmpty({ message: 'provinceCode không được để trống khi không chọn địa chỉ có sẵn' })
  @IsString()
  provinceCode?: string;

  @ValidateIf((o) => !o.addressId)
  @IsNotEmpty({ message: 'provinceName không được để trống khi không chọn địa chỉ có sẵn' })
  @IsString()
  provinceName?: string;

  @ValidateIf((o) => !o.addressId)
  @IsNotEmpty({ message: 'districtCode không được để trống khi không chọn địa chỉ có sẵn' })
  @IsString()
  districtCode?: string;

  @ValidateIf((o) => !o.addressId)
  @IsNotEmpty({ message: 'districtName không được để trống khi không chọn địa chỉ có sẵn' })
  @IsString()
  districtName?: string;

  @ValidateIf((o) => !o.addressId)
  @IsNotEmpty({ message: 'wardCode không được để trống khi không chọn địa chỉ có sẵn' })
  @IsString()
  wardCode?: string;

  @ValidateIf((o) => !o.addressId)
  @IsNotEmpty({ message: 'wardName không được để trống khi không chọn địa chỉ có sẵn' })
  @IsString()
  wardName?: string;

  @ValidateIf((o) => !o.addressId)
  @IsNotEmpty({ message: 'addressLine không được để trống khi không chọn địa chỉ có sẵn' })
  @IsString()
  addressLine?: string;

  @ValidateIf((o) => !o.addressId)
  @IsNotEmpty({ message: 'phone không được để trống khi không chọn địa chỉ có sẵn' })
  @IsString()
  phone?: string;

  @ValidateIf((o) => !o.addressId)
  @IsNotEmpty({ message: 'receiverName không được để trống khi không chọn địa chỉ có sẵn' })
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
