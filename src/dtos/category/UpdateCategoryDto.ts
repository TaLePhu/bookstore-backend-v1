import { IsOptional, IsString, MaxLength } from 'class-validator';

export class UpdateCategoryDto {
  @IsOptional()
  @IsString({ message: 'Tên thể loại phải là chuỗi' })
  @MaxLength(255, { message: 'Tên thể loại không được vượt quá 255 ký tự' })
  name?: string;

  @IsOptional()
  @IsString({ message: 'Mô tả phải là chuỗi' })
  description?: string;
}
