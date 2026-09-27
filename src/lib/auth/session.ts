import { cookies } from 'next/headers';
import { signToken, verifyToken, TokenPayload } from './jwt';

export async function getSession(req?: Request): Promise<TokenPayload | null> {
  // If a request object is passed, check headers first (Cookie or Bearer authorization)
  if (req && req.headers) {
    const authHeader = req.headers.get('authorization');
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.substring(7);
      const verified = await verifyToken(token);
      if (verified) return verified;
    }

    const cookieHeader = req.headers.get('cookie');
    if (cookieHeader) {
      const match = cookieHeader.match(/session=([^;]+)/);
      if (match) {
        const verified = await verifyToken(match[1]);
        if (verified) return verified;
      }
    }
  }

  try {
    const cookieStore = await cookies();
    const sessionCookie = cookieStore.get('session')?.value;
    if (!sessionCookie) return null;
    return await verifyToken(sessionCookie);
  } catch {
    return null;
  }
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
