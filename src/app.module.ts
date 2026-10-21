import { Module } from '@nestjs/common';
import { AppController } from './app.controller.js';
import { PrismaModule } from './prisma/prisma.module.js';
import { ProductsModule } from './products/products.module.js';
import { PedidosModule } from './pedidos/pedidos.module.js';
import { PedidoProductosModule } from './pedido-productos/pedido-productos.module.js';

@Module({
  imports: [PrismaModule, ProductsModule, PedidosModule, PedidoProductosModule],
  controllers: [AppController],
})
export class AppModule {}
