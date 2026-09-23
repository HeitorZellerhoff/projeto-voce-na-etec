'use server';

import { db } from '@/lib/db';
import { requireAuth } from '@/lib/auth';
import { MovementType } from '@/generated/prisma';

export async function processInventoryMovement(itemId: string, quantity: number, type: MovementType) {
  if (quantity <= 0) {
    throw new Error("Quantidade deve ser maior que zero");
  }

  const session = await requireAuth();

  return await db.$transaction(async (tx) => {
    // 1. Localizar saldo atual com bloqueio (FOR UPDATE implícito no Prisma sob transação)
    let balance = await tx.inventoryBalance.findUnique({
      where: {
        sectorId_itemId: {
          sectorId: session.sectorId,
          itemId: itemId
        }
      }
    });

    if (type === MovementType.OUT) {
      if (!balance || balance.quantity < quantity) {
        throw new Error("Saldo insuficiente no setor para retirada");
      }
    }

    if (!balance && type === MovementType.IN) {
      // Cria registro de saldo se não existe
      balance = await tx.inventoryBalance.create({
        data: {
          sectorId: session.sectorId,
          itemId: itemId,
          quantity: 0
        }
      });
    }

    // 2. Atualizar saldo. Utilizamos decrement/increment atômicos no DB, mas
    // já validamos o valor atual.
    await tx.inventoryBalance.update({
      where: { id: balance!.id },
      data: {
        quantity: {
          [type === MovementType.IN ? 'increment' : 'decrement']: quantity
        }
      }
    });

    // 3. Registrar a movimentação
    const movement = await tx.inventoryMovement.create({
      data: {
        type,
        quantity,
        itemId,
        sectorId: session.sectorId,
        userId: session.userId,
      }
    });

    return movement;
  });
}

// Funções utilitárias
export async function getInventoryBalance() {
  const session = await requireAuth();
  
  return await db.inventoryBalance.findMany({
    where: { sectorId: session.sectorId },
    include: {
      item: true
    }
  });
}
