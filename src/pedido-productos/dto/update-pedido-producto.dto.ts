import { Type } from 'class-transformer';
import { IsInt, Min } from 'class-validator';

export class UpdatePedidoProductoDto {
  @Type(() => Number)
  @IsInt()
  @Min(1)
  cantidad!: number;
}
