import { SignJWT, jwtVerify } from 'jose';

const secretKey = process.env.JWT_SECRET || 'chave-secreta-desenvolvimento-apenas';
const key = new TextEncoder().encode(secretKey);

export interface TokenPayload {
  sub: string;
  sectorId: string;
  roleId: string;
}

export async function signToken(payload: TokenPayload): Promise<string> {
  return await new SignJWT(payload as any)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(key);
}

export async function verifyToken(token: string): Promise<TokenPayload | null> {
  try {
    const { payload } = await jwtVerify(token, key, {
      algorithms: ['HS256'],
    });
    return payload as unknown as TokenPayload;
  } catch (error) {
    return null;
  }
}
