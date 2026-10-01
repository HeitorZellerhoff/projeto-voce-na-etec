/**
 * Módulo Facade Central de Autenticação.
 * Reúne e expõe as funções de JWT, gerenciamento de sessões, criptografia e validação de setor.
 */
import { prisma } from './prisma';
import { getSession } from './auth/session';

export * from './auth/jwt';
export * from './auth/session';
export * from './auth/crypto';

// Função para garantir isolamento de setor (Sector Isolation) no Server Side
export async function requireAuth() {
  const session = await getSession();
  if (!session) {
    throw new Error('Acesso negado: Requer autenticação');
  }
  
  // Confirmação extra no banco de dados para evitar tokens defasados se o setor mudar ou usuário for bloqueado
  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { sectorId: true, status: true }
  });

  if (!user || user.status !== 'ATIVO' || user.sectorId !== session.sectorId) {
    throw new Error('Acesso negado: Conta inativa, setor divergente ou inexistente');
  }

  return session;
}
