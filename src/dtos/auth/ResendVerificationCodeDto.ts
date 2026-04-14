import { IsEmail, IsNotEmpty } from 'class-validator';

export class ResendVerificationCodeDto {
  @IsEmail({}, { message: 'Email must be a valid email address' })
  @IsNotEmpty()
  email: string;
}