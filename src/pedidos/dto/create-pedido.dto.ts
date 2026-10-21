import { Transform, Type } from 'class-transformer';
import {
  ArrayUnique,
  ArrayMinSize,
  IsArray,
  IsIn,
  IsNotEmpty,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { PedidoProductoItemDto } from './pedido-producto-item.dto.js';

export class CreatePedidoDto {
  @IsString()
  @IsNotEmpty()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  cedula!: string;

  @IsOptional()
  @IsString()
  @IsIn(['pendiente', 'entregado', 'negado'])
  estado?: string;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayUnique((item: PedidoProductoItemDto) => item.productId)
  @ValidateNested({ each: true })
  @Type(() => PedidoProductoItemDto)
  productos!: PedidoProductoItemDto[];
}
