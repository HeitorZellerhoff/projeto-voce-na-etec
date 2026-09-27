import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { withAuth, withSectorScoping } from '@/lib/security/guards';
import { RequestStatus } from '@/generated/prisma';

const createRequestSchema = z.object({
  supplyingSectorId: z.string().uuid('Setor fornecedor inválido'),
  observation: z.string().max(500, 'Observação não pode exceder 500 caracteres').optional(),
  items: z.array(z.object({
    productId: z.string().uuid('ID do produto inválido'),
    batchId: z.string().uuid().optional(),
    requestedQuantity: z.number().int().positive('Quantidade solicitada deve ser maior que zero'),
  })).min(1, 'A solicitação deve conter pelo menos um item'),
});

/**
 * GET /api/inventory/requests
 * Lista solicitações associadas ao setor do usuário autenticado.
 * Query params: type=outgoing (minhas solicitações) | type=incoming (solicitações recebidas) | all
 */
export const GET = withAuth(async (request, context, session) => {
  try {
    const url = new URL(request.url);
    const type = url.searchParams.get('type');
    const userSectorId = session.sectorId;

    const includeOptions = {
      requestingSector: true,
      supplyingSector: true,
      requestedBy: {
        select: { id: true, name: true, email: true, registration: true }
      },
      attendedBy: {
        select: { id: true, name: true, email: true }
      },
      items: {
        include: {
          product: true,
          batch: true,
        }
      }
    };

    if (type === 'outgoing') {
      const requests = await prisma.sectorRequest.findMany({
        where: { requestingSectorId: userSectorId },
        orderBy: { createdAt: 'desc' },
        include: includeOptions,
      });
      return NextResponse.json({ success: true, data: requests });
    }

    if (type === 'incoming') {
      const requests = await prisma.sectorRequest.findMany({
        where: { supplyingSectorId: userSectorId },
        orderBy: { createdAt: 'desc' },
        include: includeOptions,
      });
      return NextResponse.json({ success: true, data: requests });
    }

    // Por padrão retorna ambas separadas
    const [outgoing, incoming] = await Promise.all([
      prisma.sectorRequest.findMany({
        where: { requestingSectorId: userSectorId },
        orderBy: { createdAt: 'desc' },
        include: includeOptions,
      }),
      prisma.sectorRequest.findMany({
        where: { supplyingSectorId: userSectorId },
        orderBy: { createdAt: 'desc' },
        include: includeOptions,
      }),
    ]);

    return NextResponse.json({ success: true, outgoing, incoming });
  } catch (error) {
    console.error('Error fetching sector requests:', error);
    return NextResponse.json({ error: 'Erro interno ao buscar solicitações de materiais' }, { status: 500 });
  }
});

/**
 * POST /api/inventory/requests
 * Cria uma nova solicitação de material entre setores.
 * SEGURANÇA CRÍTICA: O setor solicitante é OBRIGATORIAMENTE extraído da sessão autenticada (session.sectorId).
 * Qualquer setor informado no payload do cliente é sumariamente expurgado pelo withSectorScoping.
 */
export const POST = withSectorScoping(async (request, context, session) => {
  try {
    const body = await request.json();
    const parseResult = createRequestSchema.safeParse(body);

    if (!parseResult.success) {
      const errorMsg = parseResult.error.issues?.[0]?.message || 'Dados inválidos';
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }

    const { supplyingSectorId, observation, items } = parseResult.data;
    const requestingSectorId = session.sectorId;

    // Regra 1: Setor solicitante não pode ser igual ao setor fornecedor
    if (requestingSectorId === supplyingSectorId) {
      return NextResponse.json({ error: 'O setor solicitante não pode solicitar materiais de si mesmo' }, { status: 400 });
    }

    // Regra 2: Validar existência e status ativo do setor fornecedor
    const supplyingSector = await prisma.sector.findUnique({
      where: { id: supplyingSectorId }
    });

    if (!supplyingSector || supplyingSector.status !== 'ATIVO') {
      return NextResponse.json({ error: 'Setor fornecedor inexistente ou inativo' }, { status: 404 });
    }

    // Regra 3: Validar produtos solicitados
    const productIds = items.map((i: { productId: string }) => i.productId);
    const productsInDb = await prisma.product.findMany({
      where: {
        id: { in: productIds },
        status: 'ATIVO'
      }
    });

    if (productsInDb.length !== productIds.length) {
      return NextResponse.json({ error: 'Um ou mais itens solicitados não existem ou estão inativos' }, { status: 400 });
    }

    // Transação de criação da solicitação
    const createdRequest = await prisma.$transaction(async (tx) => {
      const newRequest = await tx.sectorRequest.create({
        data: {
          requestingSectorId,
          supplyingSectorId,
          requestedByUserId: session.sub,
          status: RequestStatus.PENDENTE,
          observation: observation || null,
          items: {
            create: items.map((item: { productId: string; batchId?: string; requestedQuantity: number }) => ({
              productId: item.productId,
              batchId: item.batchId || null,
              requestedQuantity: item.requestedQuantity,
              deliveredQuantity: 0,
            }))
          }
        },
        include: {
          requestingSector: true,
          supplyingSector: true,
          items: {
            include: { product: true }
          }
        }
      });

      // Auditoria
      await tx.auditLog.create({
        data: {
          userId: session.sub,
          sectorId: requestingSectorId,
          action: 'SECTOR_REQUEST_CREATE',
          entity: 'SectorRequest',
          entityId: newRequest.id,
          metadata: {
            requestingSectorId,
            supplyingSectorId,
            itemsCount: items.length,
          }
        }
      });

      return newRequest;
    });

    return NextResponse.json({ success: true, request: createdRequest }, { status: 201 });
  } catch (error) {
    console.error('Error creating sector request:', error);
    return NextResponse.json({ error: 'Erro interno ao criar solicitação de material' }, { status: 500 });
  }
});
