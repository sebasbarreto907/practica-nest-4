import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { CreatePedidoProductoDto } from './dto/create-pedido-producto.dto.js';
import { UpdatePedidoProductoDto } from './dto/update-pedido-producto.dto.js';

@Injectable()
export class PedidoProductosService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreatePedidoProductoDto) {
    return this.prisma.$transaction(async (tx) => {
      const pedido = await tx.pedido.findUnique({
        where: { id: data.pedidoId },
      });
      if (!pedido) {
        throw new NotFoundException(`Pedido ${data.pedidoId} no encontrado`);
      }

      const product = await tx.product.findUnique({
        where: { id: data.productId },
      });
      if (!product) {
        throw new UnprocessableEntityException({
          statusCode: 422,
          message: `Producto ${data.productId} no encontrado`,
          productId: data.productId,
        });
      }

      const existing = await tx.pedidoProducto.findUnique({
        where: {
          pedidoId_productId: {
            pedidoId: data.pedidoId,
            productId: data.productId,
          },
        },
      });
      if (existing) {
        throw new ConflictException(
          'El producto ya está asociado a este pedido',
        );
      }

      const cantidad = data.cantidad ?? 1;
      await this.decrementStock(tx, product, cantidad);

      const association = await tx.pedidoProducto.create({
        data: {
          pedidoId: data.pedidoId,
          productId: data.productId,
          cantidad,
        },
        include: { pedido: true, product: true },
      });
      await tx.pedido.update({
        where: { id: data.pedidoId },
        data: { cantidad: { increment: cantidad } },
      });
      return association;
    });
  }

  findAll() {
    return this.prisma.pedidoProducto.findMany({
      orderBy: { id: 'desc' },
      include: { pedido: true, product: true },
    });
  }

  async update(id: number, data: UpdatePedidoProductoDto) {
    return this.prisma.$transaction(async (tx) => {
      const association = await tx.pedidoProducto.findUnique({
        where: { id },
        include: { product: true },
      });
      if (!association) {
        throw new NotFoundException(
          `Asociación PedidoProducto ${id} no encontrada`,
        );
      }

      const diferencia = data.cantidad - association.cantidad;
      if (diferencia > 0) {
        await this.decrementStock(tx, association.product, diferencia);
      } else if (diferencia < 0) {
        await tx.product.update({
          where: { id: association.productId },
          data: { stock: { increment: -diferencia } },
        });
      }

      const updated = await tx.pedidoProducto.update({
        where: { id },
        data: { cantidad: data.cantidad },
        include: { pedido: true, product: true },
      });
      await tx.pedido.update({
        where: { id: association.pedidoId },
        data: { cantidad: { increment: diferencia } },
      });
      return updated;
    });
  }

  async remove(id: number) {
    return this.prisma.$transaction(async (tx) => {
      const association = await tx.pedidoProducto.findUnique({
        where: { id },
      });
      if (!association) {
        throw new NotFoundException(
          `Asociación PedidoProducto ${id} no encontrada`,
        );
      }

      await tx.product.update({
        where: { id: association.productId },
        data: { stock: { increment: association.cantidad } },
      });
      await tx.pedido.update({
        where: { id: association.pedidoId },
        data: { cantidad: { decrement: association.cantidad } },
      });
      return tx.pedidoProducto.delete({ where: { id } });
    });
  }

  private async decrementStock(
    tx: Prisma.TransactionClient,
    product: { id: number; name: string; stock: number },
    cantidad: number,
  ) {
    if (cantidad > product.stock) {
      throw new UnprocessableEntityException(
        {
          statusCode: 422,
          message: `Inventario insuficiente para ${product.name}`,
          productId: product.id,
          disponible: product.stock,
          solicitado: cantidad,
        },
      );
    }

    const updated = await tx.product.updateMany({
      where: { id: product.id, stock: { gte: cantidad } },
      data: { stock: { decrement: cantidad } },
    });
    if (updated.count === 0) {
      throw new UnprocessableEntityException(
        {
          statusCode: 422,
          message: `Inventario insuficiente para ${product.name}`,
          productId: product.id,
          solicitado: cantidad,
        },
      );
    }
  }
}
