import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withPermission } from '@/lib/security/guards';
import { UserStatus } from '@/generated/prisma';

export const POST = withPermission('USER_MANAGE', async (request, context, session) => {
  try {
    const params = await context.params;
    const { id } = params;

    if (!id) {
      return NextResponse.json({ error: 'ID do usuário é obrigatório' }, { status: 400 });
    }

    // Regra de segurança: Não permitir auto-bloqueio de sessão ativa
    if (id === session.sub) {
      return NextResponse.json(
        { error: 'Operação proibida: você não pode bloquear sua própria conta de administrador' },
        { status: 400 }
      );
    }

    const targetUser = await prisma.user.findUnique({
      where: { id },
      include: { role: true, sector: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    const updatedUser = await prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id },
        data: {
          status: UserStatus.BLOQUEADO,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: session.sub,
          sectorId: session.sectorId,
          action: 'USER_BLOCK',
          entity: 'User',
          entityId: targetUser.id,
          metadata: {
            targetUserName: targetUser.name,
            targetUserEmail: targetUser.email,
            previousStatus: targetUser.status,
            newStatus: UserStatus.BLOQUEADO,
          },
        },
      });

      return u;
    });

    return NextResponse.json({ success: true, user: updatedUser });
  } catch (error) {
    console.error('User block error:', error);
    return NextResponse.json({ error: 'Erro interno ao bloquear usuário' }, { status: 500 });
  }
});
