import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { withPermission, withSectorScoping } from '@/lib/security/guards';
import { MovementType } from '@/generated/prisma';

const transferSchema = z.object({
  productId: z.string().uuid(),
  batchId: z.string().uuid().optional(),
  destinationSectorId: z.string().uuid(),
  quantity: z.number().int().positive('A quantidade deve ser maior que zero'),
  reason: z.string().min(1, 'Motivo é obrigatório'),
  observation: z.string().optional(),
  sectorId: z.string().uuid().optional(),
});

export const POST = withPermission('STOCK_MANAGE', withSectorScoping(async (request, context, session) => {
  try {
    const body = await request.json();
    const result = transferSchema.safeParse(body);

    if (!result.success) {
      const errorMsg = result.error.issues?.[0]?.message || (result.error as any).errors?.[0]?.message || 'Dados inválidos';
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }

    const { productId, batchId, destinationSectorId, quantity, reason, observation } = result.data;
    const originSectorId = session.sectorId;

    if (originSectorId === destinationSectorId) {
      return NextResponse.json({ error: 'Setor de destino não pode ser o mesmo de origem' }, { status: 400 });
    }

    // Validar existência e status ativo do setor de destino
    const destinationSector = await prisma.sector.findUnique({
      where: { id: destinationSectorId }
    });

    if (!destinationSector || destinationSector.status !== 'ATIVO') {
      return NextResponse.json({ error: 'Setor de destino inexistente ou inativo' }, { status: 404 });
    }

    // Validar compatibilidade de Categoria do Produto com o Setor de Destino (DEM-011)
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true, categoryId: true }
    });

    if (!product) {
      return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 });
    }

    const sectorCategoriesCount = await prisma.sectorCategory.count({
      where: { sectorId: destinationSectorId }
    });

    if (sectorCategoriesCount > 0) {
      const isAllowed = await prisma.sectorCategory.findUnique({
        where: {
          sectorId_categoryId: {
            sectorId: destinationSectorId,
            categoryId: product.categoryId,
          }
        }
      });

      if (!isAllowed) {
        return NextResponse.json(
          { error: 'Incompatibilidade: O produto pertence a uma categoria não permitida no setor de destino' },
          { status: 400 }
        );
      }
    }


    const transactionResult = await prisma.$transaction(async (tx) => {
      // 1. Validar e Decrementar Estoque na Origem de forma Atômica
      const originStock = await tx.stock.findUnique({
        where: {
          productId_sectorId_batchId: {
            productId,
            sectorId: originSectorId,
            batchId: (batchId ?? null) as any,
          }
        }
      });

      if (!originStock || originStock.quantity < quantity) {
        throw new Error('INSUFFICIENT_FUNDS');
      }

      const updateOriginResult = await tx.stock.updateMany({
        where: {
          id: originStock.id,
          quantity: { gte: quantity }
        },
        data: {
          quantity: { decrement: quantity }
        }
      });

      if (updateOriginResult.count === 0) {
        throw new Error('INSUFFICIENT_FUNDS');
      }

      const updatedOriginStock = await tx.stock.findUniqueOrThrow({
        where: { id: originStock.id }
      });

      const originMovement = await tx.stockMovement.create({
        data: {
          productId,
          sectorId: originSectorId,
          sourceSectorId: originSectorId,
          destinationSectorId: destinationSectorId,
          batchId,
          type: MovementType.TRANSFERENCIA,
          quantity,
          previousBalance: originStock.quantity,
          newBalance: updatedOriginStock.quantity,
          reason,
          observation: `Transferência para o setor ${destinationSector.name}. ` + (observation || ''),
          performedByUserId: session.sub,
        }
      });

      // 2. Incrementar Estoque no Destino
      const updatedDestinationStock = await tx.stock.upsert({
        where: {
          productId_sectorId_batchId: {
            productId,
            sectorId: destinationSectorId,
            batchId: (batchId ?? null) as any,
          }
        },
        update: { quantity: { increment: quantity } },
        create: {
          productId,
          sectorId: destinationSectorId,
          batchId: (batchId ?? null) as any,
          quantity: quantity
        }
      });

      const destinationMovement = await tx.stockMovement.create({
        data: {
          productId,
          sectorId: destinationSectorId,
          sourceSectorId: originSectorId,
          destinationSectorId: destinationSectorId,
          batchId,
          type: MovementType.TRANSFERENCIA,
          quantity,
          previousBalance: updatedDestinationStock.quantity - quantity,
          newBalance: updatedDestinationStock.quantity,
          reason,
          observation: `Transferência recebida do setor de origem. ` + (observation || ''),
          performedByUserId: session.sub,
        }
      });

      // 3. Auditoria
      await tx.auditLog.create({
        data: {
          userId: session.sub,
          sectorId: originSectorId,
          action: 'INVENTORY_TRANSFER',
          entity: 'StockMovement',
          entityId: originMovement.id,
          metadata: { quantity, productId, originSectorId, destinationSectorId, batchId }
        }
      });

      return { originMovement, destinationMovement };
    });

    return NextResponse.json({ success: true, data: transactionResult }, { status: 201 });

  } catch (error: any) {
    if (error.message === 'INSUFFICIENT_FUNDS') {
      return NextResponse.json({ error: 'Saldo insuficiente em estoque na origem' }, { status: 400 });
    }
    console.error('Inventory transfer error:', error);
    return NextResponse.json({ error: 'Erro interno ao processar a transferência de estoque' }, { status: 500 });
  }
}));
