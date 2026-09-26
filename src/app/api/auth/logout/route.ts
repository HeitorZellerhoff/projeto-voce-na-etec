import { NextResponse } from 'next/server';
import { destroySession } from '@/lib/auth/session';

export async function POST(request: Request) {
  await destroySession();
  const acceptHeader = request.headers.get('accept') || '';
  if (acceptHeader.includes('text/html')) {
    return NextResponse.redirect(new URL('/login', request.url), 303);
  }
  return NextResponse.json({ success: true });
}

export async function GET(request: Request) {
  await destroySession();
  return NextResponse.redirect(new URL('/login', request.url), 303);
}
