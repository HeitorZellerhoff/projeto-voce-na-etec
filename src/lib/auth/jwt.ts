import { SignJWT, jwtVerify } from 'jose';

export function getJwtSecretKey(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret || secret.trim() === '') {
    throw new Error('FATAL: A variável de ambiente JWT_SECRET é obrigatória e não foi configurada.');
  }
  if (secret.length < 32) {
    throw new Error('FATAL: A variável de ambiente JWT_SECRET é insegura (mínimo de 32 caracteres exigido para HS256).');
  }
  return new TextEncoder().encode(secret);
}

export interface TokenPayload {
  sub: string;
  sectorId: string;
  roleId: string;
  userId?: string;
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
    // Falha segura: Se o erro for de configuração ausente/insegura do JWT_SECRET, propaga explicitamente
    if (error instanceof Error && error.message.startsWith('FATAL: A variável de ambiente JWT_SECRET')) {
      throw error;
    }
    return null;
  }
}
