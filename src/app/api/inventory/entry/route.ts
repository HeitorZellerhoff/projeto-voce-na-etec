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
  sectorId: z.string().uuid().optional(),
});

export const POST = withPermission('STOCK_MANAGE', withSectorScoping(async (request, context, session) => {
  try {
    const body = await request.json();
    const result = entrySchema.safeParse(body);

    if (!result.success) {
      const errorMsg = result.error.issues?.[0]?.message || (result.error as any).errors?.[0]?.message || 'Dados inválidos';
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }

    const { productId, batchId, quantity, reason, observation } = result.data;
    const sectorId = session.sectorId;

    // Validar existência do produto e compatibilidade de categoria com o setor (DEM-011)
    const product = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true, categoryId: true }
    });

    if (!product) {
      return NextResponse.json({ error: 'Produto não encontrado' }, { status: 404 });
    }

    const sectorCategoriesCount = await prisma.sectorCategory.count({
      where: { sectorId }
    });

    if (sectorCategoriesCount > 0) {
      const isAllowed = await prisma.sectorCategory.findUnique({
        where: {
          sectorId_categoryId: {
            sectorId,
            categoryId: product.categoryId,
          }
        }
      });

      if (!isAllowed) {
        return NextResponse.json(
          { error: 'Incompatibilidade: O produto pertence a uma categoria não autorizada para este setor' },
          { status: 400 }
        );
      }
    }

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
