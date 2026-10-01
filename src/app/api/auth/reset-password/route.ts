import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createHash } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { hashPassword } from '@/lib/auth/crypto';
import { UserStatus } from '@/generated/prisma';

const resetPasswordSchema = z.object({
  token: z.string().min(10, 'Token de recuperação inválido'),
  newPassword: z.string().min(8, 'A nova senha deve ter no mínimo 8 caracteres'),
});

export async function POST(request: Request) {
  try {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Corpo da requisição inválido' }, { status: 400 });
    }

    const result = resetPasswordSchema.safeParse(body);

    if (!result.success) {
      const errorMsg = result.error.issues?.[0]?.message || (result.error as any).errors?.[0]?.message || 'Dados inválidos';
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }

    const { token, newPassword } = result.data;
    const tokenHash = createHash('sha256').update(token).digest('hex');

    const resetRecord = await prisma.passwordResetToken.findFirst({
      where: { tokenHash },
      include: { user: true },
      orderBy: { expiresAt: 'desc' },
    });

    if (!resetRecord) {
      return NextResponse.json({ error: 'Token de recuperação inválido ou inexistente' }, { status: 400 });
    }

    if (resetRecord.usedAt !== null) {
      return NextResponse.json(
        { error: 'Este link de recuperação já foi utilizado anteriormente' },
        { status: 400 }
      );
    }

    if (resetRecord.expiresAt < new Date()) {
      return NextResponse.json(
        { error: 'Este link de recuperação expirou. Por favor, solicite um novo link' },
        { status: 400 }
      );
    }

    if (resetRecord.user.status !== UserStatus.ATIVO) {
      return NextResponse.json(
        { error: `Acesso negado: Conta de colaborador com status ${resetRecord.user.status}` },
        { status: 403 }
      );
    }

    const newPasswordHash = await hashPassword(newPassword);

    await prisma.$transaction(async (tx) => {
      // 1. Atualiza a senha e desbloqueia primeiro acesso se aplicável
      await tx.user.update({
        where: { id: resetRecord.userId },
        data: {
          passwordHash: newPasswordHash,
          mustChangePassword: false,
          passwordChangedAt: new Date(),
        },
      });

      // 2. Invalida o token atual marcando usedAt
      await tx.passwordResetToken.update({
        where: { id: resetRecord.id },
        data: {
          usedAt: new Date(),
        },
      });

      // 3. Invalida preventivamente todos os outros tokens pendentes deste usuário (DEM-018)
      await tx.passwordResetToken.updateMany({
        where: {
          userId: resetRecord.userId,
          usedAt: null,
        },
        data: {
          usedAt: new Date(),
        },
      });

      // 4. Registra auditoria de segurança
      await tx.auditLog.create({
        data: {
          userId: resetRecord.userId,
          sectorId: resetRecord.user.sectorId,
          action: 'AUTH_PASSWORD_RESET_SUCCESS',
          entity: 'User',
          entityId: resetRecord.userId,
          metadata: { email: resetRecord.user.email },
        },
      });
    });

    return NextResponse.json({
      success: true,
      message: 'Senha redefinida com sucesso. Você já pode fazer login com sua nova senha.',
    });

  } catch (error) {
    console.error('Reset password error:', error);
    return NextResponse.json({ error: 'Erro interno ao redefinir a senha' }, { status: 500 });
  }
}
