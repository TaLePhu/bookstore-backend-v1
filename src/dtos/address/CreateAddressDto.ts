import {
  IsNotEmpty,
  IsString,
  MaxLength,
  MinLength,
  IsOptional,
  IsBoolean,
} from 'class-validator';

export class CreateAddressDto {
  @IsNotEmpty({ message: 'receiverName là bắt buộc' })
  @IsString({ message: 'receiverName phải là chuỗi' })
  @MinLength(2, { message: 'receiverName tối thiểu 2 ký tự' })
  @MaxLength(255, { message: 'receiverName tối đa 255 ký tự' })
  receiverName: string;

  @IsNotEmpty({ message: 'phone là bắt buộc' })
  @IsString({ message: 'phone phải là chuỗi' })
  @MaxLength(20, { message: 'phone tối đa 20 ký tự' })
  phone: string;

  @IsNotEmpty({ message: 'addressLine là bắt buộc' })
  @IsString({ message: 'addressLine phải là chuỗi' })
  @MaxLength(500, { message: 'addressLine tối đa 500 ký tự' })
  addressLine: string;

  @IsNotEmpty({ message: 'country là bắt buộc' })
  @IsString({ message: 'country phải là chuỗi' })
  @MaxLength(100, { message: 'country tối đa 100 ký tự' })
  country: string;

  @IsNotEmpty({ message: 'provinceCode là bắt buộc' })
  @IsString({ message: 'provinceCode phải là chuỗi' })
  @MaxLength(50, { message: 'provinceCode tối đa 50 ký tự' })
  provinceCode: string;

  @IsNotEmpty({ message: 'provinceName là bắt buộc' })
  @IsString({ message: 'provinceName phải là chuỗi' })
  @MaxLength(100, { message: 'provinceName tối đa 100 ký tự' })
  provinceName: string;

  @IsNotEmpty({ message: 'districtCode là bắt buộc' })
  @IsString({ message: 'districtCode phải là chuỗi' })
  @MaxLength(50, { message: 'districtCode tối đa 50 ký tự' })
  districtCode: string;

  @IsNotEmpty({ message: 'districtName là bắt buộc' })
  @IsString({ message: 'districtName phải là chuỗi' })
  @MaxLength(100, { message: 'districtName tối đa 100 ký tự' })
  districtName: string;

  @IsNotEmpty({ message: 'wardCode là bắt buộc' })
  @IsString({ message: 'wardCode phải là chuỗi' })
  @MaxLength(50, { message: 'wardCode tối đa 50 ký tự' })
  wardCode: string;

  @IsNotEmpty({ message: 'wardName là bắt buộc' })
  @IsString({ message: 'wardName phải là chuỗi' })
  @MaxLength(100, { message: 'wardName tối đa 100 ký tự' })
  wardName: string;

  @IsOptional()
  @IsBoolean({ message: 'isDefault phải là boolean' })
  isDefault?: boolean;
}
