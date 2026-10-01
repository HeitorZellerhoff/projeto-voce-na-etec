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
        { error: 'Operação proibida: você não pode alterar o status de bloqueio da sua própria conta de administrador' },
        { status: 400 }
      );
    }

    let body: any = {};
    try {
      body = await request.json();
    } catch {
      body = {};
    }

    const targetUser = await prisma.user.findUnique({
      where: { id },
      include: { role: true, sector: true },
    });

    if (!targetUser) {
      return NextResponse.json({ error: 'Usuário não encontrado' }, { status: 404 });
    }

    // Determina a ação desejada (se não informada, inverte o status atual)
    const isCurrentlyBlocked = targetUser.status === UserStatus.BLOQUEADO;
    const action = body.action || (isCurrentlyBlocked ? 'UNBLOCK' : 'BLOCK');
    const newStatus = action === 'UNBLOCK' ? UserStatus.ATIVO : UserStatus.BLOQUEADO;
    const auditAction = action === 'UNBLOCK' ? 'USER_UNBLOCK' : 'USER_BLOCK';

    const updatedUser = await prisma.$transaction(async (tx) => {
      const u = await tx.user.update({
        where: { id },
        data: {
          status: newStatus,
        },
      });

      await tx.auditLog.create({
        data: {
          userId: session.sub,
          sectorId: session.sectorId,
          action: auditAction,
          entity: 'User',
          entityId: targetUser.id,
          metadata: {
            targetUserName: targetUser.name,
            targetUserEmail: targetUser.email,
            previousStatus: targetUser.status,
            newStatus,
          },
        },
      });

      return u;
    });

    return NextResponse.json({ 
      success: true, 
      user: updatedUser,
      message: action === 'UNBLOCK' ? 'Colaborador desbloqueado e reativado com sucesso' : 'Acesso do colaborador revogado e bloqueado com sucesso'
    });
  } catch (error) {
    console.error('User block/unblock error:', error);
    return NextResponse.json({ error: 'Erro interno ao alterar status do usuário' }, { status: 500 });
  }
});
