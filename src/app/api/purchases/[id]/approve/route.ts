import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission } from '@/lib/security/guards';
import { PurchaseStatus } from '@/generated/prisma';

export const POST = withPermission('PURCHASE_APPROVE', async (request, context, session) => {
  try {
    const params = await context.params;
    const { id } = params;

    if (!id) {
      return NextResponse.json({ error: 'ID da compra é obrigatório' }, { status: 400 });
    }

    const purchase = await prisma.purchase.findUnique({
      where: { id }
    });

    if (!purchase) {
      return NextResponse.json({ error: 'Compra não encontrada' }, { status: 404 });
    }

    // Regra Crítica de Segurança: Segregation of Duties (SoD)
    if (purchase.requestedByUserId === session.sub) {
      return NextResponse.json(
        { error: 'Segregação de funções: o solicitante não pode aprovar a própria compra' },
        { status: 403 }
      );
    }

    if (purchase.status !== PurchaseStatus.PENDENTE_APROVACAO) {
      return NextResponse.json(
        { error: `A compra não pode ser aprovada pois está no status ${purchase.status}` },
        { status: 400 }
      );
    }

    const updatedPurchase = await prisma.$transaction(async (tx) => {
      const p = await tx.purchase.update({
        where: { id },
        data: {
          status: PurchaseStatus.APROVADO,
          approvedById: session.sub,
        }
      });

      await tx.auditLog.create({
        data: {
          userId: session.sub,
          sectorId: session.sectorId,
          action: 'PURCHASE_APPROVE',
          entity: 'Purchase',
          entityId: purchase.id,
          metadata: { previousStatus: purchase.status, newStatus: PurchaseStatus.APROVADO }
        }
      });

      return p;
    });

    return NextResponse.json({ success: true, purchase: updatedPurchase });

  } catch (error) {
    console.error('Purchase approve error:', error);
    return NextResponse.json({ error: 'Erro interno ao aprovar a compra' }, { status: 500 });
  }
});
