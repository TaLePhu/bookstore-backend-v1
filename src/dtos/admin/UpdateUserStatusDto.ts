import { IsBoolean } from 'class-validator';

export class UpdateUserStatusDto {
  /**
   * true  → mở khoá tài khoản
   * false → khoá tài khoản
   */
  @IsBoolean({ message: 'isLocked phải là boolean' })
  isLocked: boolean;
}
