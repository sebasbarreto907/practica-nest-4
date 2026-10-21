import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service.js';
import { Prisma } from '../generated/prisma/client.js';
import { CreatePedidoDto } from './dto/create-pedido.dto.js';
import { UpdatePedidoDto } from './dto/update-pedido.dto.js';

@Injectable()
export class PedidosService {
  constructor(private readonly prisma: PrismaService) {}

  async create(data: CreatePedidoDto) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const estado = data.estado ?? 'pendiente';
        if (estado === 'pendiente') {
          await this.ensureNoPendingOrder(tx, data.cedula);
        }

        const pedido = await tx.pedido.create({
          data: {
            cedula: data.cedula,
            estado,
            cantidad: this.totalItems(data.productos),
          },
        });

        const products = await this.validateProducts(tx, data.productos);
        await this.reserveInventory(tx, products, data.productos);
        await tx.pedidoProducto.createMany({
          data: data.productos.map(({ productId, cantidad }) => ({
            pedidoId: pedido.id,
            productId,
            cantidad,
          })),
        });

        return tx.pedido.findUniqueOrThrow({
          where: { id: pedido.id },
          include: { productos: { include: { product: true } } },
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'El cliente ya tiene un pedido pendiente',
        );
      }
      throw error;
    }
  }

  findAll() {
    return this.prisma.pedido.findMany({
      orderBy: { id: 'desc' },
      include: { productos: { include: { product: true } } },
    });
  }

  async findOne(id: number) {
    const pedido = await this.prisma.pedido.findUnique({
      where: { id },
      include: { productos: { include: { product: true } } },
    });
    if (!pedido) {
      throw new NotFoundException(`Pedido ${id} no encontrado`);
    }
    return pedido;
  }

  async update(id: number, data: UpdatePedidoDto) {
    try {
      return await this.prisma.$transaction(async (tx) => {
        const pedido = await tx.pedido.findUnique({
          where: { id },
          include: { productos: true },
        });
        if (!pedido) {
          throw new NotFoundException(`Pedido ${id} no encontrado`);
        }

        if (data.estado === 'pendiente') {
          await this.ensureNoPendingOrder(tx, pedido.cedula, id);
        }

        if (data.productos !== undefined) {
          for (const item of pedido.productos) {
            await tx.product.update({
              where: { id: item.productId },
              data: { stock: { increment: item.cantidad } },
            });
          }
          const products = await this.validateProducts(tx, data.productos);
          await this.reserveInventory(tx, products, data.productos);
          await tx.pedidoProducto.deleteMany({ where: { pedidoId: id } });
        }

        const updateData: Prisma.PedidoUpdateInput = {};
        if (data.estado !== undefined) {
          updateData.estado = data.estado;
        }
        if (data.productos !== undefined) {
          updateData.cantidad = this.totalItems(data.productos);
          updateData.productos = {
            create: data.productos.map(({ productId, cantidad }) => ({
              cantidad,
              product: { connect: { id: productId } },
            })),
          };
        }

        return tx.pedido.update({
          where: { id },
          data: updateData,
          include: { productos: { include: { product: true } } },
        });
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'El cliente ya tiene un pedido pendiente',
        );
      }
      throw error;
    }
  }

  async remove(id: number) {
    return this.prisma.$transaction(async (tx) => {
      const pedido = await tx.pedido.findUnique({
        where: { id },
        include: { productos: true },
      });
      if (!pedido) {
        throw new NotFoundException(`Pedido ${id} no encontrado`);
      }

      for (const item of pedido.productos) {
        await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.cantidad } },
        });
      }
      await tx.pedidoProducto.deleteMany({ where: { pedidoId: id } });
      return tx.pedido.delete({ where: { id } });
    });
  }

  private totalItems(productos: { cantidad: number }[]) {
    return productos.reduce((total, item) => total + item.cantidad, 0);
  }

  private async ensureNoPendingOrder(
    tx: Prisma.TransactionClient,
    cedula: string,
    excludeId?: number,
  ) {
    const pedido = await tx.pedido.findFirst({
      where: {
        cedula,
        estado: 'pendiente',
        ...(excludeId !== undefined && { id: { not: excludeId } }),
      },
    });
    if (pedido) {
      throw new ConflictException(
        'El cliente ya tiene un pedido pendiente',
      );
    }
  }

  private async validateProducts(
    tx: Prisma.TransactionClient,
    productos: { productId: number; cantidad: number }[],
  ) {
    const productIds = productos.map(({ productId }) => productId);
    const products = await tx.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true, name: true, stock: true },
    });
    const foundIds = new Set(products.map(({ id }) => id));
    const missingIds = productIds.filter((id) => !foundIds.has(id));

    if (missingIds.length > 0) {
      throw new UnprocessableEntityException({
        statusCode: 422,
        message: `Productos no encontrados: ${missingIds.join(', ')}`,
        missingProductIds: missingIds,
      });
    }
    return products;
  }

  private async reserveInventory(
    tx: Prisma.TransactionClient,
    products: { id: number; name: string; stock: number }[],
    productos: { productId: number; cantidad: number }[],
  ) {
    const requestedByProduct = new Map<number, number>();
    for (const item of productos) {
      requestedByProduct.set(
        item.productId,
        (requestedByProduct.get(item.productId) ?? 0) + item.cantidad,
      );
    }

    for (const [productId, requested] of requestedByProduct) {
      const product = products.find(({ id }) => id === productId)!;
      if (requested > product.stock) {
        throw new UnprocessableEntityException(
          {
            statusCode: 422,
            message: `Inventario insuficiente para ${product.name}`,
            productId,
            disponible: product.stock,
            solicitado: requested,
          },
        );
      }

      const updated = await tx.product.updateMany({
        where: { id: productId, stock: { gte: requested } },
        data: { stock: { decrement: requested } },
      });
      if (updated.count === 0) {
        const current = await tx.product.findUnique({
          where: { id: productId },
          select: { stock: true },
        });
        throw new UnprocessableEntityException(
          {
            statusCode: 422,
            message: `Inventario insuficiente para ${product.name}`,
            productId,
            disponible: current?.stock ?? 0,
            solicitado: requested,
          },
        );
      }
    }
  }
}
