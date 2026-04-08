import { IsOptional, MinLength, MaxLength, IsDateString, IsString } from 'class-validator';

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  avatar?: string;

  @IsOptional()
  @MinLength(2, { message: 'Name must be at least 2 characters long' })
  @MaxLength(255, { message: 'Name must not exceed 255 characters' })
  fullName?: string;

  @IsOptional()
  @IsDateString()
  dob?: string;

  @IsOptional()
  @IsString()
  gender?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsString()
  address?: string;
}
