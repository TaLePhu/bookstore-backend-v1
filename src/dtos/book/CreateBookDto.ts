import { IsNotEmpty, IsString, IsNumber, IsOptional, IsArray, Min, MaxLength } from 'class-validator';
import { Transform } from 'class-transformer';

function parseHighlights(value: unknown): string[] | undefined {
  if (value === undefined || value === null) return undefined;
  if (Array.isArray(value)) return value as string[];
  if (typeof value !== 'string') return value as string[];

  const trimmed = value.trim();
  if (trimmed === '') return [];

  try {
    const parsed = JSON.parse(trimmed);
    if (Array.isArray(parsed)) return parsed as string[];
  } catch {
    // Fall through to comma split
  }

  return trimmed
    .split(',')
    .map((item) => item.trim())
    .filter((item) => item.length > 0);
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
  @IsOptional()
  @IsNumber()
  @Min(0)
  price?: number;

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
  @Transform(({ value }) => parseHighlights(value))
  highlights?: string[];

  @IsOptional()
  @IsString()
  releaseDate?: string;
}
