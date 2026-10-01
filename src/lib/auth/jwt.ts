import { SignJWT, jwtVerify } from 'jose';

function getJwtSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.trim() === '') {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('FATAL: A variável de ambiente JWT_SECRET é obrigatória em ambiente de produção.');
    }
    return new TextEncoder().encode('dev-secret-key-tcc-hospital-dev-only-min32chars');
  }
  return new TextEncoder().encode(secret);
}

export interface TokenPayload {
  sub: string;
  sectorId: string;
  roleId: string;
}

export async function signToken(payload: TokenPayload): Promise<string> {
  const key = getJwtSecretKey();
  return await new SignJWT(payload as any)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(key);
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const key = getJwtSecretKey();
    const { payload } = await jwtVerify(token, key, {
      algorithms: ['HS256'],
    });
    return payload as unknown as TokenPayload;
  } catch (error) {
    return null;
  }
}
