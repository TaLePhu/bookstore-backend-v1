import { IsNotEmpty, IsUUID } from 'class-validator';

export class RefreshTokenDto {
  @IsNotEmpty()
  refreshToken: string;

  @IsUUID()
  deviceId: string;
}
