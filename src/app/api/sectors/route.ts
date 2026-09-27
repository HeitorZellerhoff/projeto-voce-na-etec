import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/security/guards';

export const GET = withAuth(async (request, context, session) => {
  try {
    const sectors = await prisma.sector.findMany({
      where: { status: 'ATIVO' },
      include: {
        allowedCategories: {
          include: { category: true }
        }
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json({ success: true, sectors });
  } catch (error) {
    console.error('Error fetching sectors:', error);
    return NextResponse.json({ error: 'Erro interno ao listar setores' }, { status: 500 });
  }
});
