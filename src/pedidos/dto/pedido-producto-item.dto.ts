import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class PedidoProductoItemDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  productId!: number;

  @Type(() => Number)
  @IsInt()
  @Min(1)
  cantidad!: number;
}