import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/security/guards';
import { SectorStatus } from '@/generated/prisma';

const createSectorSchema = z.object({
  name: z.string().min(3, 'O nome do setor deve ter pelo menos 3 caracteres'),
  code: z.string().min(2, 'O código do setor deve ter pelo menos 2 caracteres').toUpperCase(),
  description: z.string().optional(),
  location: z.string().optional(),
  responsibleName: z.string().optional(),
  categoryIds: z.array(z.string().uuid()).optional(),
});

export const GET = withAuth(async (request, context, session) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: session.sub },
      include: { role: true }
    });

    if (user?.role?.name !== 'ADMINISTRADOR') {
      return NextResponse.json({ error: 'Acesso negado: Requer privilégios de Administrador' }, { status: 403 });
    }

    const sectors = await prisma.sector.findMany({
      include: {
        allowedCategories: {
          include: { category: true }
        },
        _count: {
          select: { users: true, stocks: true }
        }
      },
      orderBy: { name: 'asc' }
    });

    return NextResponse.json({ success: true, sectors });
  } catch (error) {
    console.error('Error listing admin sectors:', error);
    return NextResponse.json({ error: 'Erro ao listar setores' }, { status: 500 });
  }
});

export const POST = withAuth(async (request, context, session) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: session.sub },
      include: { role: true }
    });

    if (user?.role?.name !== 'ADMINISTRADOR') {
      return NextResponse.json({ error: 'Acesso negado: Requer privilégios de Administrador' }, { status: 403 });
    }

    const body = await request.json();
    const result = createSectorSchema.safeParse(body);

    if (!result.success) {
      const errorMsg = result.error.issues?.[0]?.message || 'Dados inválidos';
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }

    const { name, code, description, location, responsibleName, categoryIds } = result.data;

    const existingSector = await prisma.sector.findUnique({
      where: { code }
    });

    if (existingSector) {
      return NextResponse.json({ error: 'Já existe um setor com este código' }, { status: 400 });
    }

    const newSector = await prisma.$transaction(async (tx) => {
      const s = await tx.sector.create({
        data: {
          name,
          code,
          description: description || null,
          location: location || null,
          responsibleName: responsibleName || null,
          status: SectorStatus.ATIVO,
          allowedCategories: categoryIds && categoryIds.length > 0 ? {
            create: categoryIds.map((catId: string) => ({
              categoryId: catId
            }))
          } : undefined
        },
        include: {
          allowedCategories: { include: { category: true } }
        }
      });

      await tx.auditLog.create({
        data: {
          userId: session.sub,
          sectorId: session.sectorId,
          action: 'SECTOR_CREATE',
          entity: 'Sector',
          entityId: s.id,
          metadata: { name: s.name, code: s.code }
        }
      });

      return s;
    });

    return NextResponse.json({ success: true, sector: newSector }, { status: 201 });
  } catch (error) {
    console.error('Error creating sector:', error);
    return NextResponse.json({ error: 'Erro interno ao cadastrar setor' }, { status: 500 });
  }
});
