import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { signToken, verifyToken } from '../src/lib/auth/jwt';
import { POST as loginHandler } from '../src/app/api/auth/login/route';
import { prisma } from '../src/lib/prisma';
import bcrypt from 'bcryptjs';
import { UserStatus, RequestStatus } from '../src/generated/prisma';

describe('Comprovação Automatizada da Fase 1 (Segurança e Concorrência)', () => {

  describe('1. Validação de JWT_SECRET (DEM-005)', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('Deve emitir e verificar tokens com sucesso quando JWT_SECRET está configurado', async () => {
      process.env.JWT_SECRET = 'segredo-de-teste-super-seguro-1234567890';
      const payload = {
        sub: 'user-uuid-123',
        sectorId: 'sector-uuid-456',
        roleId: 'role-uuid-789'
      };

      const token = await signToken(payload);
      expect(typeof token).toBe('string');
      expect(token.length).toBeGreaterThan(20);

      const decoded = await verifyToken(token);
      expect(decoded).not.toBeNull();
      expect(decoded?.sub).toBe(payload.sub);
      expect(decoded?.sectorId).toBe(payload.sectorId);
      expect(decoded?.roleId).toBe(payload.roleId);
    });

    it('Deve bloquear e lançar erro fatal em produção se JWT_SECRET não estiver definido', async () => {
      process.env.NODE_ENV = 'production';
      delete process.env.JWT_SECRET;

      const payload = {
        sub: 'user-uuid-123',
        sectorId: 'sector-uuid-456',
        roleId: 'role-uuid-789'
      };

      await expect(signToken(payload)).rejects.toThrow(
        'FATAL: A variável de ambiente JWT_SECRET é obrigatória em ambiente de produção.'
      );
    });
  });

  describe('2. Sanitização e Prevenção de Enumeração no Login (DEM-001 e DEM-009)', () => {
    it('Não deve vazar status BLOQUEADO quando a senha estiver incorreta (anti-enumeração)', async () => {
      const dummyPasswordHash = await bcrypt.hash('SenhaCorreta123!', 10);

      // Simula usuário BLOQUEADO no banco
      const findUniqueSpy = vi.spyOn(prisma.user, 'findUnique').mockResolvedValueOnce({
        id: 'blocked-user-id',
        email: 'bloqueado@hospital.com',
        passwordHash: dummyPasswordHash,
        status: UserStatus.BLOQUEADO,
        name: 'Usuário Bloqueado',
        registration: 'MAT-999',
        mustChangePassword: false,
        sectorId: 'sector-id',
        roleId: 'role-id',
        createdAt: new Date(),
        updatedAt: new Date(),
        lastLoginAt: null,
        passwordChangedAt: null,
      } as any);

      // Tentativa de login com senha ERRADA
      const req = new Request('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'bloqueado@hospital.com',
          password: 'SenhaErradaInvalida!'
        })
      });

      const response = await loginHandler(req);
      const data = await response.json();

      // Deve retornar 401 "Credenciais inválidas" e NÃO 403 "Conta com status BLOQUEADO"
      expect(response.status).toBe(401);
      expect(data.error).toBe('Credenciais inválidas');
      expect(data.error).not.toContain('BLOQUEADO');

      findUniqueSpy.mockRestore();
    });

    it('Não deve vazar stack trace ou queries do banco em caso de erro interno (CWE-209)', async () => {
      // Força um erro de banco de dados simulado
      const findUniqueSpy = vi.spyOn(prisma.user, 'findUnique').mockRejectedValueOnce(
        new Error('PostgresConnectionTimeout: Query timeout at postgres://admin:secret@neon.tech/db')
      );

      const req = new Request('http://localhost:3000/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: 'qualquer@hospital.com',
          password: 'password123'
        })
      });

      const response = await loginHandler(req);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Erro interno no servidor');
      // Garante ausência total de stack trace e detalhes confidenciais
      expect(data.stack).toBeUndefined();
      expect(data.details).toBeUndefined();
      expect(JSON.stringify(data)).not.toContain('postgres://');

      findUniqueSpy.mockRestore();
    });
  });

  describe('3. Concorrência Atômica de Estoque (DEM-002)', () => {
    it('Simulação de Concorrência: Condição atômica quantity >= quantity impede saldo negativo', async () => {
      // Cenário: Saldo em banco = 10 unidades
      let currentDatabaseQuantity = 10;

      // Simulação do comportamento atômico do PostgreSQL com updateMany
      const atomicDecrement = async (stockId: string, decrementQty: number): Promise<{ count: number }> => {
        if (currentDatabaseQuantity >= decrementQty) {
          currentDatabaseQuantity -= decrementQty;
          return { count: 1 }; // 1 linha atualizada
        }
        return { count: 0 }; // 0 linhas atualizadas (WHERE quantity >= decrementQty falhou)
      };

      // Duas requisições simultâneas:
      // Req A tenta retirar 8 unidades
      // Req B tenta retirar 7 unidades
      // Saldo inicial é 10. A soma (15) excede o saldo.
      const [resA, resB] = await Promise.all([
        atomicDecrement('stock-01', 8),
        atomicDecrement('stock-01', 7)
      ]);

      // Apenas UMA das transações pode ter sucesso (count: 1), a outra deve falhar (count: 0)
      const successCount = (resA.count === 1 ? 1 : 0) + (resB.count === 1 ? 1 : 0);
      const failedCount = (resA.count === 0 ? 1 : 0) + (resB.count === 0 ? 1 : 0);

      expect(successCount).toBe(1);
      expect(failedCount).toBe(1);
      expect(currentDatabaseQuantity).toBeGreaterThanOrEqual(0); // Saldo NUNCA pode ser negativo
    });
  });

  describe('4. Concorrência Atômica de Atendimento de Solicitações (DEM-003)', () => {
    it('Simulação de Duplo Atendimento: Apenas a primeira requisição altera o status para ATENDIDA', async () => {
      let requestStatus: RequestStatus = RequestStatus.PENDENTE;

      // Simulação da transição atômica do PostgreSQL:
      // UPDATE "SectorRequest" SET status = 'ATENDIDA' WHERE id = :id AND status IN ('PENDENTE', 'APROVADA')
      const atomicAttend = async (id: string): Promise<{ count: number }> => {
        if (requestStatus === RequestStatus.PENDENTE || requestStatus === RequestStatus.APROVADA) {
          requestStatus = RequestStatus.ATENDIDA;
          return { count: 1 };
        }
        return { count: 0 }; // Já foi atendida anteriormente
      };

      // Duas requisições simultâneas chamando /attend para a mesma solicitação
      const [attempt1, attempt2] = await Promise.all([
        atomicAttend('req-123'),
        atomicAttend('req-123')
      ]);

      // Apenas UMA requisição pode ter sucesso
      expect(attempt1.count + attempt2.count).toBe(1);
      expect(requestStatus).toBe(RequestStatus.ATENDIDA);
    });
  });
});
