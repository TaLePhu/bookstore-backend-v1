import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';
import { OrderStatus } from '@entities/Order';

export class UpdateOrderStatusDto {
  @IsEnum(OrderStatus, { message: 'status khong hop le' })
  status: OrderStatus;

  @IsOptional()
  @IsString({ message: 'note phai la chuoi' })
  @MaxLength(500, { message: 'note toi da 500 ky tu' })
  note?: string;
}
