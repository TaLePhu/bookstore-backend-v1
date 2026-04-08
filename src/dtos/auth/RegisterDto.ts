import { IsEmail, IsNotEmpty, MinLength, MaxLength, Matches } from 'class-validator';

export class RegisterDto {
  @IsNotEmpty()
  @MinLength(2, { message: 'Username must be at least 2 characters long' })
  @MaxLength(255, { message: 'Username must not exceed 255 characters' })
  userName: string;

  @IsEmail({}, { message: 'Email must be a valid email address' })
  @IsNotEmpty()
  email: string;

  @IsNotEmpty()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  @MaxLength(255, { message: 'Password must not exceed 255 characters' })
  password: string;
}
