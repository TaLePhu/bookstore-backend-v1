import { IsNotEmpty, MinLength, MaxLength } from 'class-validator';

export class ChangePasswordDto {
  @IsNotEmpty()
  oldPassword: string;

  @IsNotEmpty()
  @MinLength(6, { message: 'Password must be at least 6 characters long' })
  @MaxLength(255, { message: 'Password must not exceed 255 characters' })
  newPassword: string;
}
