import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { withPermission, withSectorScoping } from '@/lib/security/guards';
import { MovementType } from '@/generated/prisma';

const exitSchema = z.object({
  productId: z.string().uuid(),
  batchId: z.string().uuid().optional(),
  quantity: z.number().int().positive('A quantidade deve ser maior que zero'),
  reason: z.string().min(1, 'Motivo é obrigatório'),
  observation: z.string().optional(),
  sectorId: z.string().uuid().optional(),
});

export const POST = withPermission('STOCK_MANAGE', withSectorScoping(async (request, context, session) => {
  try {
    const body = await request.json();
    const result = exitSchema.safeParse(body);

    if (!result.success) {
      const errorMsg = result.error.issues?.[0]?.message || (result.error as any).errors?.[0]?.message || 'Dados inválidos';
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }

    const { productId, batchId, quantity, reason, observation } = result.data;
    const sectorId = session.sectorId;

    const transactionResult = await prisma.$transaction(async (tx) => {
      // Locking the row for update na lógica de negócios
      const stock = await tx.stock.findUnique({
        where: {
          productId_sectorId_batchId: {
            productId,
            sectorId,
            batchId: (batchId ?? null) as any,
          }
        }
      });

      // Validação Crítica de Negócio: Saldo nunca pode ser negativo
      if (!stock || stock.quantity < quantity) {
        throw new Error('INSUFFICIENT_FUNDS');
      }

      const updatedStock = await tx.stock.update({
        where: { id: stock.id },
        data: { quantity: { decrement: quantity } }
      });

      const movement = await tx.stockMovement.create({
        data: {
          productId,
          sectorId,
          batchId,
          type: MovementType.SAIDA,
          quantity,
          previousBalance: stock.quantity,
          newBalance: updatedStock.quantity,
          reason,
          observation,
          performedByUserId: session.sub,
        }
      });

      await tx.auditLog.create({
        data: {
          userId: session.sub,
          sectorId,
          action: 'INVENTORY_EXIT',
          entity: 'StockMovement',
          entityId: movement.id,
          metadata: { quantity, productId, batchId }
        }
      });

      return movement;
    });

    return NextResponse.json({ success: true, movement: transactionResult }, { status: 201 });

  } catch (error: any) {
    if (error.message === 'INSUFFICIENT_FUNDS') {
      return NextResponse.json({ error: 'Saldo insuficiente em estoque' }, { status: 400 });
    }
    console.error('Inventory exit error:', error);
    return NextResponse.json({ error: 'Erro interno ao processar a saída de estoque' }, { status: 500 });
  }
}));
