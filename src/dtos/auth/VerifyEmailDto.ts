import { IsEmail, IsNotEmpty, Length } from 'class-validator';

export class VerifyEmailDto {
  @IsEmail({}, { message: 'Email must be a valid email address' })
  @IsNotEmpty()
  email: string;

  @IsNotEmpty()
  @Length(6, 6, { message: 'Code must be exactly 6 characters long' })
  code: string;
}
