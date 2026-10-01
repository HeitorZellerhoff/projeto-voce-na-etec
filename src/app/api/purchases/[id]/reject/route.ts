import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/security/guards';
import { PurchaseStatus } from '@/generated/prisma';
import { z } from 'zod';

const rejectPurchaseSchema = z.object({
  reason: z.string().min(3, 'O motivo da rejeição/cancelamento deve ter pelo menos 3 caracteres').optional(),
});

export const POST = withAuth(async (request, context, session) => {
  try {
    const params = await context.params;
    const { id } = params;

    if (!id) {
      return NextResponse.json({ error: 'ID da compra é obrigatório' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const parseResult = rejectPurchaseSchema.safeParse(body);
    const reasonText = parseResult.success && parseResult.data.reason ? parseResult.data.reason : 'Cancelada/Rejeitada na revisão';

    const purchase = await prisma.purchase.findUnique({
      where: { id },
      include: {
        requestedBy: true,
        supplier: true,
      }
    });

    if (!purchase) {
      return NextResponse.json({ error: 'Compra não encontrada' }, { status: 404 });
    }

    const isRequester = purchase.requestedByUserId === session.sub;

    // Verificar se o usuário possui permissão de aprovação de compras caso não seja o solicitante
    let hasApprovePermission = false;
    if (!isRequester) {
      const user = await prisma.user.findUnique({
        where: { id: session.sub },
        include: { role: { include: { permissions: { include: { permission: true } } } } }
      });
      hasApprovePermission = user?.role?.permissions.some(
        (rp) => rp.permission.action === 'PURCHASE_APPROVE'
      ) ?? false;
    }

    if (!isRequester && !hasApprovePermission) {
      return NextResponse.json(
        { error: 'Você não possui permissão para rejeitar ou cancelar esta compra' },
        { status: 403 }
      );
    }

    if (purchase.status !== PurchaseStatus.PENDENTE_APROVACAO && purchase.status !== PurchaseStatus.RASCUNHO) {
      return NextResponse.json(
        { error: `Esta compra não pode ser rejeitada/cancelada pois está no status ${purchase.status}` },
        { status: 400 }
      );
    }

    const updatedPurchase = await prisma.$transaction(async (tx) => {
      const updated = await tx.purchase.update({
        where: { id },
        data: {
          status: PurchaseStatus.CANCELADO,
        }
      });

      await tx.auditLog.create({
        data: {
          userId: session.sub,
          sectorId: session.sectorId,
          action: isRequester ? 'PURCHASE_CANCEL' : 'PURCHASE_REJECT',
          entity: 'Purchase',
          entityId: purchase.id,
          metadata: {
            reason: reasonText,
            previousStatus: purchase.status,
            supplierName: purchase.supplier?.name,
            totalAmount: purchase.totalAmount,
          }
        }
      });

      return updated;
    });

    return NextResponse.json({ 
      success: true, 
      purchase: updatedPurchase,
      message: isRequester ? 'Compra cancelada com sucesso' : 'Compra rejeitada com sucesso'
    });

  } catch (error) {
    console.error('Purchase reject/cancel error:', error);
    return NextResponse.json({ error: 'Erro interno ao rejeitar/cancelar a compra' }, { status: 500 });
  }
});
