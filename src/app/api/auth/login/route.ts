import { NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/prisma';
import { verifyPassword } from '@/lib/auth/crypto';
import { createSession } from '@/lib/auth/session';
import { UserStatus } from '@/generated/prisma';

const loginSchema = z.object({
  email: z.string().email('Formato de e-mail inválido'),
  password: z.string().min(1, 'A senha é obrigatória'),
});

export async function POST(request: Request) {
  const acceptHeader = request.headers.get('accept') || '';
  const isHtmlRequest = acceptHeader.includes('text/html');

  try {
    let rawBody: any = {};
    const contentType = request.headers.get('content-type') || '';

    if (contentType.includes('application/json')) {
      rawBody = await request.json();
    } else if (contentType.includes('application/x-www-form-urlencoded') || contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      rawBody = Object.fromEntries(formData.entries());
    } else {
      try {
        rawBody = await request.json();
      } catch {
        rawBody = {};
      }
    }

    const result = loginSchema.safeParse(rawBody);

    if (!result.success) {
      const errorMsg = (result.error as any).errors?.[0]?.message || 'Dados inválidos';
      if (isHtmlRequest) {
        return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(errorMsg)}`, request.url), 303);
      }
      return NextResponse.json({ error: errorMsg }, { status: 400 });
    }

    const { email, password } = result.data;

    const user = await prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      if (isHtmlRequest) {
        return NextResponse.redirect(new URL('/login?error=Credenciais%20inv%C3%A1lidas', request.url), 303);
      }
      return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 });
    }

    if (user.status !== UserStatus.ATIVO) {
      const errorMsg = `Acesso negado: Conta com status ${user.status}`;
      if (isHtmlRequest) {
        return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(errorMsg)}`, request.url), 303);
      }
      return NextResponse.json({ error: errorMsg }, { status: 403 });
    }

    const isValid = await verifyPassword(password, user.passwordHash);
    if (!isValid) {
      if (isHtmlRequest) {
        return NextResponse.redirect(new URL('/login?error=Credenciais%20inv%C3%A1lidas', request.url), 303);
      }
      return NextResponse.json({ error: 'Credenciais inválidas' }, { status: 401 });
    }

    // Atualiza o timestamp do último login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() }
    });

    // Cria o cookie de sessão seguro
    await createSession({
      sub: user.id,
      sectorId: user.sectorId,
      roleId: user.roleId,
    });

    if (isHtmlRequest) {
      const destination = user.mustChangePassword ? '/primeiro-acesso' : '/dashboard';
      return NextResponse.redirect(new URL(destination, request.url), 303);
    }

    return NextResponse.json({
      success: true,
      mustChangePassword: user.mustChangePassword,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        status: user.status
      }
    });

  } catch (error: any) {
    console.error('Login error:', error);
    if (isHtmlRequest) {
      return NextResponse.redirect(new URL('/login?error=Erro%20interno%20no%20servidor', request.url), 303);
    }
    return NextResponse.json({ 
      error: 'Erro interno no servidor', 
      details: error?.message || String(error),
      stack: error?.stack 
    }, { status: 500 });
  }
}
