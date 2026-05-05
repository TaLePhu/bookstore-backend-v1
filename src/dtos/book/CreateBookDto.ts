import { IsNotEmpty, IsString, IsNumber, IsOptional, IsArray, Min, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class BookImageDto {
  @IsNotEmpty({ message: 'URL hình ảnh không được để trống' })
  @IsString()
  imageUrl: string;

  @IsOptional()
  isPrimary?: boolean;
}

export class CreateBookDto {
  @IsNotEmpty({ message: 'Tiêu đề không được để trống' })
  @IsString()
  @MaxLength(255)
  title: string;

  @IsNotEmpty({ message: 'Tác giả không được để trống' })
  @IsString()
  @MaxLength(255)
  author: string;

  @IsNotEmpty({ message: 'Giá bán không được để trống' })
  @IsNumber()
  @Min(0)
  price: number;

  @IsNotEmpty({ message: 'Giá gốc không được để trống' })
  @IsNumber()
  @Min(0)
  originalPrice: number;

  @IsNotEmpty({ message: 'ID Thể loại không được để trống' })
  @IsString()
  categoryId: string;

  @IsNotEmpty({ message: 'Số lượng tồn kho không được để trống' })
  @IsNumber()
  @Min(0)
  stock: number;

  @IsNotEmpty({ message: 'Mô tả không được để trống' })
  @IsString()
  description: string;

  @IsNotEmpty({ message: 'ISBN không được để trống' })
  @IsString()
  @MaxLength(20)
  isbn: string;

  // Optional fields
  @IsOptional()
  @IsString()
  translator?: string;

  @IsOptional()
  @IsString()
  publisher?: string;

  @IsOptional()
  @IsNumber()
  publishYear?: number;

  @IsOptional()
  @IsNumber()
  pages?: number;

  @IsOptional()
  @IsString()
  dimensions?: string;

  @IsOptional()
  @IsString()
  weight?: string;

  @IsOptional()
  @IsString()
  format?: string;

  @IsOptional()
  @IsString()
  language?: string;

  @IsOptional()
  @IsNumber()
  discount?: number;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  highlights?: string[];

  @IsOptional()
  @IsString()
  releaseDate?: string;

  @IsNotEmpty({ message: 'Hình ảnh sách không được để trống' })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BookImageDto)
  images: BookImageDto[];
}
