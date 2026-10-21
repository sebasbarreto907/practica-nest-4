import { Type } from 'class-transformer';
import {
  ArrayUnique,
  IsArray,
  IsIn,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { PedidoProductoItemDto } from './pedido-producto-item.dto.js';

export class UpdatePedidoDto {
  @IsOptional()
  @IsString()
  @IsIn(['pendiente', 'entregado', 'negado'])
  estado?: string;

  @IsOptional()
  @IsArray()
  @ArrayUnique((item: PedidoProductoItemDto) => item.productId)
  @ValidateNested({ each: true })
  @Type(() => PedidoProductoItemDto)
  productos?: PedidoProductoItemDto[];
}
