import { IsOptional, IsString, IsNumber, IsArray, Min, MaxLength, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';
import { BookImageDto } from './CreateBookDto';

export class UpdateBookDto {
  @IsOptional()
  @IsString()
  @MaxLength(255)
  title?: string;

  @IsOptional()
  @IsString()
  @MaxLength(255)
  author?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  originalPrice?: number;

  @IsOptional()
  @IsString()
  categoryId?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  stock?: number;

  @IsOptional()
  @IsString()
  description?: string;

  @IsOptional()
  @IsString()
  @MaxLength(20)
  isbn?: string;

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

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => BookImageDto)
  images?: BookImageDto[];
}
