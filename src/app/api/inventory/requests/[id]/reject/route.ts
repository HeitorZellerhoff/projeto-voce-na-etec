import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/security/guards';
import { RequestStatus } from '@/generated/prisma';
import { z } from 'zod';

const rejectSchema = z.object({
  reason: z.string().min(3, 'O motivo da rejeição deve ter pelo menos 3 caracteres'),
});

export const POST = withAuth(async (request, context, session) => {
  try {
    const params = await context.params;
    const { id } = params;

    if (!id) {
      return NextResponse.json({ error: 'ID da solicitação é obrigatório' }, { status: 400 });
    }

    const body = await request.json().catch(() => ({}));
    const parseResult = rejectSchema.safeParse(body);
    const reasonText = parseResult.success ? parseResult.data.reason : 'Rejeitada pelo setor fornecedor';

    const sectorRequest = await prisma.sectorRequest.findUnique({
      where: { id },
      include: { requestingSector: true, supplyingSector: true }
    });

    if (!sectorRequest) {
      return NextResponse.json({ error: 'Solicitação não encontrada' }, { status: 404 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.sub },
      include: { role: true }
    });

    const isSupplyingSectorUser = session.sectorId === sectorRequest.supplyingSectorId;
    const isRequestingUser = session.sub === sectorRequest.requestedByUserId;
    const isAdmin = user?.role?.name === 'ADMINISTRADOR';

    if (!isSupplyingSectorUser && !isRequestingUser && !isAdmin) {
      return NextResponse.json(
        { error: 'Você não possui permissão para rejeitar ou cancelar esta solicitação' },
        { status: 403 }
      );
    }

    if (sectorRequest.status !== RequestStatus.PENDENTE) {
      return NextResponse.json(
        { error: `Esta solicitação não pode ser rejeitada pois está no status ${sectorRequest.status}` },
        { status: 400 }
      );
    }

    const updatedRequest = await prisma.$transaction(async (tx) => {
      const updated = await tx.sectorRequest.update({
        where: { id },
        data: {
          status: isRequestingUser && !isSupplyingSectorUser ? RequestStatus.CANCELADA : RequestStatus.REJEITADA,
          attendedByUserId: session.sub,
          observation: (sectorRequest.observation ? sectorRequest.observation + ' | ' : '') + `Motivo: ${reasonText}`,
        }
      });

      await tx.auditLog.create({
        data: {
          userId: session.sub,
          sectorId: session.sectorId,
          action: isRequestingUser && !isSupplyingSectorUser ? 'SECTOR_REQUEST_CANCEL' : 'SECTOR_REQUEST_REJECT',
          entity: 'SectorRequest',
          entityId: sectorRequest.id,
          metadata: { reason: reasonText, previousStatus: sectorRequest.status }
        }
      });

      return updated;
    });

    return NextResponse.json({ success: true, request: updatedRequest });
  } catch (error) {
    console.error('Error rejecting sector request:', error);
    return NextResponse.json({ error: 'Erro interno ao rejeitar solicitação' }, { status: 500 });
  }
});
