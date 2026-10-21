import { Module } from '@nestjs/common';
import { PedidoProductosController } from './pedido-productos.controller.js';
import { PedidoProductosService } from './pedido-productos.service.js';

@Module({
  controllers: [PedidoProductosController],
  providers: [PedidoProductosService],
})
export class PedidoProductosModule {}
