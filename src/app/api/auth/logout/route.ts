import { NextResponse } from 'next/server';
import { getSession, destroySession } from '@/lib/auth/session';
import { logAuditAction } from '@/lib/audit';

export async function POST(request: Request) {
  const session = await getSession(request);
  if (session?.sub) {
    await logAuditAction({
      userId: session.sub,
      sectorId: session.sectorId,
      action: 'AUTH_LOGOUT',
      entity: 'USER',
      entityId: session.sub,
      req: request,
    });
  }

  await destroySession();
  const acceptHeader = request.headers.get('accept') || '';
  if (acceptHeader.includes('text/html')) {
    return NextResponse.redirect(new URL('/login', request.url), 303);
  }
  return NextResponse.json({ success: true });
}

export async function GET(request: Request) {
  const session = await getSession(request);
  if (session?.sub) {
    await logAuditAction({
      userId: session.sub,
      sectorId: session.sectorId,
      action: 'AUTH_LOGOUT',
      entity: 'USER',
      entityId: session.sub,
      req: request,
    });
  }

  await destroySession();
  return NextResponse.redirect(new URL('/login', request.url), 303);
}

