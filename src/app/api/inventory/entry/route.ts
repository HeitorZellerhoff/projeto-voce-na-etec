import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { withPermission, withSectorScoping } from '@/lib/security/guards';
import { MovementType } from '@/generated/prisma';

const entrySchema = z.object({
  productId: z.string().uuid(),
  batchId: z.string().uuid().optional(),
  quantity: z.number().int().positive('A quantidade deve ser maior que zero'),
  reason: z.string().min(1, 'Motivo é obrigatório'),
  observation: z.string().optional(),
  sectorId: z.string().uuid()
});

export const POST = withPermission('STOCK_MANAGE', withSectorScoping(async (request, context, session) => {
  try {
    const body = await request.json();
    const result = entrySchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: (result.error as any).errors[0].message }, { status: 400 });
    }

    const { productId, batchId, quantity, reason, observation, sectorId } = result.data;

    // Transação Atômica ACID
    const transactionResult = await prisma.$transaction(async (tx) => {
      // 1. Busca ou Cria o registro de Estoque para o setor e lote
      const stock = await tx.stock.upsert({
        where: {
          productId_sectorId_batchId: {
            productId,
            sectorId,
            batchId: (batchId ?? null) as any,
          }
        },
        update: {
          quantity: { increment: quantity }
        },
        create: {
          productId,
          sectorId,
          batchId: (batchId ?? null) as any,
          quantity: quantity
        }
      });

      const previousBalance = stock.quantity - quantity;
      const newBalance = stock.quantity;

      // 2. Registra o Movimento
      const movement = await tx.stockMovement.create({
        data: {
          productId,
          sectorId,
          batchId,
          type: MovementType.ENTRADA,
          quantity,
          previousBalance,
          newBalance,
          reason,
          observation,
          performedByUserId: session.sub,
        }
      });

      // 3. Log de Auditoria
      await tx.auditLog.create({
        data: {
          userId: session.sub,
          sectorId,
          action: 'INVENTORY_ENTRY',
          entity: 'StockMovement',
          entityId: movement.id,
          metadata: { quantity, productId, batchId }
        }
      });

      return movement;
    });

    return NextResponse.json({ success: true, movement: transactionResult }, { status: 201 });

  } catch (error) {
    console.error('Inventory entry error:', error);
    return NextResponse.json({ error: 'Erro interno ao processar a entrada de estoque' }, { status: 500 });
  }
}));
