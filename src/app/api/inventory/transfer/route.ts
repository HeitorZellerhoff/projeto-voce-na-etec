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

    const transactionResult = await prisma.$transaction(async (tx) => {
      // 1. Validar Estoque na Origem
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

      const updatedOriginStock = await tx.stock.update({
        where: { id: originStock.id },
        data: { quantity: { decrement: quantity } }
      });

      const originMovement = await tx.stockMovement.create({
        data: {
          productId,
          sectorId: originSectorId,
          batchId,
          type: MovementType.TRANSFERENCIA,
          quantity,
          previousBalance: originStock.quantity,
          newBalance: updatedOriginStock.quantity,
          reason,
          observation: `Transferência para o setor ${destinationSectorId}. ` + (observation || ''),
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
          batchId,
          type: MovementType.TRANSFERENCIA,
          quantity,
          previousBalance: updatedDestinationStock.quantity - quantity,
          newBalance: updatedDestinationStock.quantity,
          reason,
          observation: `Transferência recebida do setor ${originSectorId}. ` + (observation || ''),
          performedByUserId: session.sub, // Autoria permanece de quem iniciou a transferência
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
