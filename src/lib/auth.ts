import { db } from './db';
import { getSession } from './jwt';

export * from './jwt';

// Função para garantir isolamento de setor (Sector Isolation)
// Esta função sempre confiará no cookie criptografado e validará no DB
export async function requireAuth() {
  const session = await getSession();
  if (!session) {
    throw new Error('Acesso negado: Requer autenticação');
  }
  
  // Confirmação extra no banco de dados para evitar tokens defasados se o setor mudar
  const user = await db.user.findUnique({
    where: { id: session.userId },
    select: { sectorId: true }
  });

  if (!user || user.sectorId !== session.sectorId) {
    throw new Error('Acesso negado: Setor divergente ou conta inexistente');
  }

  return session;
}
