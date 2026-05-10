import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { Role } from '@entities/User';

export class CreateAdminUserDto {
  @IsNotEmpty()
  @MinLength(2)
  @MaxLength(255)
  userName: string;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(255)
  fullName?: string;

  @IsEmail()
  @IsNotEmpty()
  email: string;

  @IsOptional()
  @Matches(/^[0-9+\-\s()]{8,20}$/, { message: 'Phone number is invalid' })
  phone?: string;

  @IsNotEmpty()
  @MinLength(8)
  @MaxLength(255)
  @Matches(/[a-z]/, { message: 'Password must contain at least one lowercase letter' })
  @Matches(/[A-Z]/, { message: 'Password must contain at least one uppercase letter' })
  @Matches(/[0-9]/, { message: 'Password must contain at least one number' })
  password: string;

  @IsEnum(Role)
  role: Role.CUSTOMER | Role.STAFF;

  @IsOptional()
  isVerified?: boolean;
}
