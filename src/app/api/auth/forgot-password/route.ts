import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createHash, randomBytes } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { logAuditAction } from '@/lib/audit';

const forgotPasswordSchema = z.object({
  email: z.string().email('Formato de e-mail inválido'),
});

export async function POST(request: Request) {
  try {
    let body: any;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: 'Corpo da requisição inválido' }, { status: 400 });
    }

    const result = forgotPasswordSchema.safeParse(body);

    if (!result.success) {
      const errorMsg = result.error.issues?.[0]?.message || (result.error as any).errors?.[0]?.message || 'Dados inválidos';
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }

    const { email } = result.data;
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (user && user.status === 'ATIVO') {
      // 1. Invalida tokens de recuperação anteriores ainda pendentes/não utilizados (DEM-018 / Seção 11)
      await prisma.passwordResetToken.updateMany({
        where: {
          userId: user.id,
          usedAt: null,
        },
        data: {
          usedAt: new Date(),
        },
      });

      // 2. Gera novo token aleatório criptograficamente seguro (32 bytes hex = 64 chars)
      const rawToken = randomBytes(32).toString('hex');
      const tokenHash = createHash('sha256').update(rawToken).digest('hex');
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hora de validade

      // 3. Armazena estritamente o hash SHA-256 no banco (nunca o token em texto puro)
      await prisma.passwordResetToken.create({
        data: {
          tokenHash,
          userId: user.id,
          expiresAt,
        },
      });

      if (process.env.NODE_ENV !== 'production') {
        console.info(`[DEV RECOVERY LINK] /redefinir-senha?token=${rawToken}`);
      }

      await logAuditAction({
        userId: user.id,
        sectorId: user.sectorId,
        action: 'AUTH_FORGOT_PASSWORD_REQUEST',
        entity: 'User',
        entityId: user.id,
        metadata: { email: user.email },
        req: request,
      });
    }

    // Resposta unificada de tempo constante contra enumeração de e-mails (DEM-009 / DEM-018)
    return NextResponse.json(
      { success: true, message: 'Se o e-mail estiver cadastrado, as instruções de recuperação foram enviadas.' },
      { status: 202 }
    );
  } catch (error) {
    console.error('Forgot password error:', error);
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
  }
}

