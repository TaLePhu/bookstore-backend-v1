import { IsOptional, IsString, MaxLength } from 'class-validator';

export class RejectCancelRequestDto {
  @IsOptional()
  @IsString({ message: 'note phai la chuoi' })
  @MaxLength(500, { message: 'note toi da 500 ky tu' })
  note?: string;
}
