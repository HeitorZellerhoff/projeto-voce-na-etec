import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { withPermission, withSectorScoping } from '@/lib/security/guards';
import { MovementType } from '@/generated/prisma';

const adjustmentSchema = z.object({
  productId: z.string().uuid(),
  batchId: z.string().uuid().optional(),
  newQuantity: z.number().int().min(0, 'A quantidade não pode ser negativa'),
  reason: z.string().min(1, 'Motivo é obrigatório'),
  observation: z.string().optional(),
  sectorId: z.string().uuid()
});

export const POST = withPermission('STOCK_ADJUST', withSectorScoping(async (request, context, session) => {
  try {
    const body = await request.json();
    const result = adjustmentSchema.safeParse(body);

    if (!result.success) return NextResponse.json({ error: result.error.errors[0].message }, { status: 400 });

    const { productId, batchId, newQuantity, reason, observation, sectorId } = result.data;

    const transactionResult = await prisma.$transaction(async (tx) => {
      let stock = await tx.stock.findUnique({
        where: {
          productId_sectorId_batchId: {
            productId,
            sectorId,
            batchId: batchId ?? null,
          }
        }
      });

      const previousBalance = stock ? stock.quantity : 0;
      const quantityDiff = newQuantity - previousBalance;

      if (quantityDiff === 0) {
        throw new Error('NO_CHANGES');
      }

      const updatedStock = await tx.stock.upsert({
        where: {
          productId_sectorId_batchId: {
            productId,
            sectorId,
            batchId: batchId ?? null,
          }
        },
        update: { quantity: newQuantity },
        create: {
          productId,
          sectorId,
          batchId: batchId ?? null,
          quantity: newQuantity
        }
      });

      const movement = await tx.stockMovement.create({
        data: {
          productId,
          sectorId,
          batchId,
          type: MovementType.AJUSTE,
          quantity: Math.abs(quantityDiff),
          previousBalance,
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
          action: 'INVENTORY_ADJUSTMENT',
          entity: 'StockMovement',
          entityId: movement.id,
          metadata: { previousBalance, newQuantity, quantityDiff, productId, batchId }
        }
      });

      return movement;
    });

    return NextResponse.json({ success: true, movement: transactionResult }, { status: 201 });

  } catch (error: any) {
    if (error.message === 'NO_CHANGES') {
      return NextResponse.json({ error: 'Nenhuma alteração de saldo requerida' }, { status: 400 });
    }
    console.error('Inventory adjustment error:', error);
    return NextResponse.json({ error: 'Erro interno ao processar ajuste de estoque' }, { status: 500 });
  }
}));
