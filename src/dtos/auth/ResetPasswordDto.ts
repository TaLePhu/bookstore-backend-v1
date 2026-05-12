import { IsEmail, IsNotEmpty, Length, Matches, MaxLength, MinLength } from 'class-validator';

export class ResetPasswordDto {
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @IsNotEmpty({ message: 'Vui lòng nhập email' })
  email: string;

  @IsNotEmpty({ message: 'Vui lòng nhập mã xác thực' })
  @Length(6, 6, { message: 'Mã xác thực phải gồm 6 chữ số' })
  code: string;

  @IsNotEmpty({ message: 'Vui lòng nhập mật khẩu mới' })
  @MinLength(8, { message: 'Mật khẩu mới phải có ít nhất 8 ký tự' })
  @MaxLength(255, { message: 'Mật khẩu mới không được vượt quá 255 ký tự' })
  @Matches(/[a-z]/, { message: 'Mật khẩu phải chứa ít nhất 1 chữ thường' })
  @Matches(/[A-Z]/, { message: 'Mật khẩu phải chứa ít nhất 1 chữ hoa' })
  @Matches(/[0-9]/, { message: 'Mật khẩu phải chứa ít nhất 1 số' })
  newPassword: string;
}
