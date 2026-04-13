import { IsEnum } from 'class-validator';
import { Role } from '@entities/User';

export class UpdateUserRoleDto {
  @IsEnum(Role, { message: `role phải là một trong: ${Object.values(Role).join(', ')}` })
  role: Role;
}
