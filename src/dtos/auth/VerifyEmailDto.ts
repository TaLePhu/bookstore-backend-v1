import { IsEmail, IsNotEmpty, Length } from 'class-validator';

export class VerifyEmailDto {
  @IsEmail({}, { message: 'Email must be a valid email address' })
  @IsNotEmpty()
  email: string;

  @IsNotEmpty()
  @Length(4, 4, { message: 'Code must be exactly 4 characters long' })
  code: string;
}
