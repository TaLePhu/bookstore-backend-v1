import { IsNotEmpty, IsInt, Min, IsUUID } from 'class-validator';

export class AddToCartDto {
  @IsNotEmpty({ message: 'bookId không được để trống' })
  @IsUUID('4', { message: 'bookId phải là UUID hợp lệ' })
  bookId: string;

  @IsNotEmpty({ message: 'Số lượng không được để trống' })
  @IsInt({ message: 'Số lượng phải là số nguyên' })
  @Min(1, { message: 'Số lượng phải lớn hơn hoặc bằng 1' })
  quantity: number;
}
