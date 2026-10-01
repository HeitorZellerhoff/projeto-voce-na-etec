import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/security/guards';
import { PurchaseStatus } from '@/generated/prisma';

const createPurchaseSchema = z.object({
  supplierId: z.string().uuid(),
  totalAmount: z.number().positive().optional(),
  items: z.array(z.object({
    productId: z.string().uuid(),
    quantity: z.number().int().positive(),
    unitPrice: z.number().positive()
  })).min(1, 'A compra deve ter pelo menos um item')
});

export const POST = withAuth(async (request, context, session) => {
  try {
    const body = await request.json();
    const result = createPurchaseSchema.safeParse(body);

    if (!result.success) return NextResponse.json({ error: (result.error as any).errors[0].message }, { status: 400 });

    const { supplierId, totalAmount, items } = result.data;

    // Transação para criação do Purchase e seus Itens
    const purchase = await prisma.$transaction(async (tx) => {
      const p = await tx.purchase.create({
        data: {
          supplierId,
          status: PurchaseStatus.PENDENTE_APROVACAO, // Correspondente a SOLICITADA
          totalAmount,
          requestedByUserId: session.sub,
          items: {
            create: items.map((i: { productId: string; quantity: number; unitPrice: number }) => ({
              productId: i.productId,
              quantity: i.quantity,
              unitPrice: i.unitPrice
            }))
          }
        },
        include: { items: true }
      });

      await tx.auditLog.create({
        data: {
          userId: session.sub,
          sectorId: session.sectorId,
          action: 'PURCHASE_CREATE',
          entity: 'Purchase',
          entityId: p.id,
          metadata: { totalAmount, itemsCount: items.length }
        }
      });

      return p;
    });

    return NextResponse.json({ success: true, purchase }, { status: 201 });

  } catch (error) {
    console.error('Purchase creation error:', error);
    return NextResponse.json({ error: 'Erro interno ao criar a solicitação de compra' }, { status: 500 });
  }
});

export const GET = withAuth(async (request, _context, _session) => {
  try {
    const url = new URL(request.url);
    const statusParam = url.searchParams.get('status');
    const supplierId = url.searchParams.get('supplierId');
    const page = Math.max(1, parseInt(url.searchParams.get('page') || '1', 10));
    const limit = Math.min(100, Math.max(1, parseInt(url.searchParams.get('limit') || '50', 10)));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (statusParam && Object.values(PurchaseStatus).includes(statusParam as PurchaseStatus)) {
      where.status = statusParam as PurchaseStatus;
    }

    if (supplierId) {
      where.supplierId = supplierId;
    }

    const [total, purchases] = await Promise.all([
      prisma.purchase.count({ where }),
      prisma.purchase.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          supplier: true,
          requestedBy: {
            select: { id: true, name: true, email: true, registration: true }
          },
          approvedBy: {
            select: { id: true, name: true, email: true }
          },
          items: {
            include: {
              product: {
                select: { id: true, name: true, code: true, unit: true }
              }
            }
          }
        }
      })
    ]);

    return NextResponse.json({
      success: true,
      purchases,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit)
      }
    });

  } catch (error) {
    console.error('List purchases error:', error);
    return NextResponse.json({ error: 'Erro interno ao listar pedidos de compra' }, { status: 500 });
  }
});

