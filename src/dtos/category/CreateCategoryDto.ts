import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class CreateCategoryDto {
  @IsNotEmpty({ message: 'Tên thể loại không được để trống' })
  @IsString({ message: 'Tên thể loại phải là chuỗi' })
  @MaxLength(255, { message: 'Tên thể loại không được vượt quá 255 ký tự' })
  name: string;

  @IsNotEmpty({ message: 'Mô tả không được để trống' })
  @IsString({ message: 'Mô tả phải là chuỗi' })
  description: string;
}
