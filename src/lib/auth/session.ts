import { cookies } from 'next/headers';
import { signToken, verifyToken, TokenPayload } from './jwt';

export async function getSession(): Promise<TokenPayload | null> {
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get('session')?.value;
  if (!sessionCookie) return null;
  return await verifyToken(sessionCookie);
}

export async function createSession(payload: TokenPayload): Promise<void> {
  const cookieStore = await cookies();
  const expires = new Date(Date.now() + 8 * 60 * 60 * 1000); // 8 hours
  const token = await signToken(payload);

  cookieStore.set('session', token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    expires: expires,
    sameSite: 'lax',
    path: '/',
  });
}

export async function destroySession(): Promise<void> {
  const cookieStore = await cookies();
  cookieStore.delete('session');
}
