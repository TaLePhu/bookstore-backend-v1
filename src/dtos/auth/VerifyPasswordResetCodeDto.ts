import { IsEmail, IsNotEmpty, Length } from 'class-validator';

export class VerifyPasswordResetCodeDto {
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @IsNotEmpty({ message: 'Vui lòng nhập email' })
  email: string;

  @IsNotEmpty({ message: 'Vui lòng nhập mã xác thực' })
  @Length(6, 6, { message: 'Mã xác thực phải gồm 6 chữ số' })
  code: string;
}
