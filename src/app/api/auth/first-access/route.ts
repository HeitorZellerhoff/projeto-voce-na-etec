import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth/session';
import { hashPassword } from '@/lib/auth/crypto';

const firstAccessSchema = z.object({
  newPassword: z.string().min(8, 'A nova senha deve ter no mínimo 8 caracteres'),
});

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Sessão inválida ou não autenticado' }, { status: 401 });
    }

    const body = await request.json();
    const result = firstAccessSchema.safeParse(body);

    if (!result.success) {
      return NextResponse.json({ error: (result.error as any).errors[0].message }, { status: 400 });
    }

    const user = await prisma.user.findUnique({
      where: { id: session.sub },
    });

    if (!user || !user.mustChangePassword) {
      return NextResponse.json({ error: 'Ação não permitida ou senha já alterada' }, { status: 403 });
    }

    const newPasswordHash = await hashPassword(result.data.newPassword);

    await prisma.user.update({
      where: { id: user.id },
      data: {
        passwordHash: newPasswordHash,
        mustChangePassword: false,
        passwordChangedAt: new Date(),
      },
    });

    return NextResponse.json({ success: true, message: 'Senha alterada com sucesso' });

  } catch (error) {
    console.error('First access error:', error);
    return NextResponse.json({ error: 'Erro interno no servidor' }, { status: 500 });
  }
}
