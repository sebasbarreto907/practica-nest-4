import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { CreatePedidoProductoDto } from './dto/create-pedido-producto.dto.js';
import { UpdatePedidoProductoDto } from './dto/update-pedido-producto.dto.js';
import { PedidoProductosService } from './pedido-productos.service.js';

@Controller('pedido-productos')
export class PedidoProductosController {
  constructor(private readonly pedidoProductosService: PedidoProductosService) {}

  @Post()
  create(@Body() data: CreatePedidoProductoDto) {
    return this.pedidoProductosService.create(data);
  }

  @Get()
  findAll() {
    return this.pedidoProductosService.findAll();
  }

  @Patch(':id')
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() data: UpdatePedidoProductoDto,
  ) {
    return this.pedidoProductosService.update(id, data);
  }

  @Delete(':id')
  remove(@Param('id', ParseIntPipe) id: number) {
    return this.pedidoProductosService.remove(id);
  }
}
