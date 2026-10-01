import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';
import { signToken, verifyToken, getJwtSecretKey } from '../src/lib/auth/jwt';
import { POST as loginHandler } from '../src/app/api/auth/login/route';
import { POST as exitRoute } from '../src/app/api/inventory/exit/route';
import { POST as attendRoute } from '../src/app/api/inventory/requests/[id]/attend/route';
import { prisma } from '../src/lib/prisma';
import bcrypt from 'bcryptjs';
import { UserStatus, RequestStatus } from '../src/generated/prisma';
import { SignJWT } from 'jose';

describe('Comprovação Automatizada da Fase 1 (Segurança e Concorrência)', () => {

  describe('1. Validação de JWT_SECRET (DEM-005)', () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterEach(() => {
      process.env = originalEnv;
    });

    it('Deve emitir e verificar tokens com sucesso quando JWT_SECRET está configurado e seguro (>= 32 chars)', async () => {
      process.env.JWT_SECRET = 'segredo-de-teste-super-seguro-com-mais-de-32-caracteres!';
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

    it('Deve bloquear e lançar erro fatal em qualquer ambiente se JWT_SECRET não estiver definido (sem fallback)', async () => {
      delete process.env.JWT_SECRET;

      const payload = {
        sub: 'user-uuid-123',
        sectorId: 'sector-uuid-456',
        roleId: 'role-uuid-789'
      };

      expect(() => getJwtSecretKey()).toThrow(
        'FATAL: A variável de ambiente JWT_SECRET é obrigatória e não foi configurada.'
      );

      await expect(signToken(payload)).rejects.toThrow(
        'FATAL: A variável de ambiente JWT_SECRET é obrigatória e não foi configurada.'
      );
    });

    it('Deve bloquear e lançar erro fatal se JWT_SECRET for inseguro (< 32 caracteres)', async () => {
      process.env.JWT_SECRET = 'chave-curta-insegura'; // 20 chars (< 32)

      const payload = {
        sub: 'user-uuid-123',
        sectorId: 'sector-uuid-456',
        roleId: 'role-uuid-789'
      };

      expect(() => getJwtSecretKey()).toThrow(
        'FATAL: A variável de ambiente JWT_SECRET é insegura (mínimo de 32 caracteres exigido para HS256).'
      );

      await expect(signToken(payload)).rejects.toThrow(
        'FATAL: A variável de ambiente JWT_SECRET é insegura (mínimo de 32 caracteres exigido para HS256).'
      );
    });

    it('Deve retornar null para token com assinatura adulterada ou inválida', async () => {
      process.env.JWT_SECRET = 'segredo-de-teste-super-seguro-com-mais-de-32-caracteres!';
      const validToken = await signToken({
        sub: 'user-123',
        sectorId: 'sec-123',
        roleId: 'role-123',
      });

      // Modifica partes do token JWT
      const tamperedToken = validToken.substring(0, validToken.length - 5) + 'xxxxx';
      const result = await verifyToken(tamperedToken);
      expect(result).toBeNull();
    });

    it('Deve retornar null para token já expirado', async () => {
      const secret = 'segredo-de-teste-super-seguro-com-mais-de-32-caracteres!';
      process.env.JWT_SECRET = secret;
      const key = new TextEncoder().encode(secret);

      // Assina um token que já expirou há 1 hora
      const expiredToken = await new SignJWT({
        sub: 'user-expired',
        sectorId: 'sec-123',
        roleId: 'role-123',
      })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt(Math.floor(Date.now() / 1000) - 7200)
        .setExpirationTime(Math.floor(Date.now() / 1000) - 3600)
        .sign(key);

      const result = await verifyToken(expiredToken);
      expect(result).toBeNull();
    });
  });

  describe('2. Sanitização e Prevenção de Enumeração no Login (DEM-001 e DEM-009)', () => {
    beforeEach(() => {
      process.env.JWT_SECRET = 'segredo-de-teste-super-seguro-com-mais-de-32-caracteres!';
      vi.spyOn(prisma.auditLog, 'create').mockResolvedValue({ id: 'audit-id' } as any);
    });

    afterEach(() => {
      vi.restoreAllMocks();
    });

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
      expect(data.stack).toBeUndefined();
      expect(data.details).toBeUndefined();
      expect(JSON.stringify(data)).not.toContain('postgres://');

      findUniqueSpy.mockRestore();
    });
  });

  describe('3. Concorrência Real e Prevenção de Saldo Negativo (DEM-002)', () => {
    beforeEach(() => {
      process.env.JWT_SECRET = 'segredo-de-teste-super-seguro-com-mais-de-32-caracteres!';
      vi.restoreAllMocks();
    });

    it('Cenário Concorrente 1: 10 requisições simultâneas de 25 unidades sobre saldo inicial de 100', async () => {
      const userSub = crypto.randomUUID();
      const sectorId = crypto.randomUUID();
      const productId = crypto.randomUUID();
      const stockId = crypto.randomUUID();

      const initialQuantity = 100;
      const databaseStock = {
        id: stockId,
        productId,
        sectorId,
        batchId: null,
        quantity: initialQuantity,
      };

      const committedMovements: any[] = [];
      const committedAudits: any[] = [];

      // Simulação atômica de banco PostgreSQL com row-level lock dentro de $transaction
      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        id: userSub,
        status: UserStatus.ATIVO,
        roleId: 'role-enfermeiro',
      } as any);

      vi.spyOn(prisma.rolePermission, 'findFirst').mockResolvedValue({ id: 'perm-stock' } as any);

      vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        // Objeto tx com comportamento atômico
        const tx = {
          stock: {
            findUnique: vi.fn(async () => ({ ...databaseStock })),
            updateMany: vi.fn(async ({ where, data }: any) => {
              // Condição atômica equivalente a PostgreSQL: WHERE id = $1 AND quantity >= $2
              const decrementAmount = data.quantity.decrement;
              if (databaseStock.quantity >= decrementAmount && where.quantity.gte <= databaseStock.quantity) {
                databaseStock.quantity -= decrementAmount;
                return { count: 1 };
              }
              return { count: 0 };
            }),
            findUniqueOrThrow: vi.fn(async () => ({ ...databaseStock })),
          },
          stockMovement: {
            create: vi.fn(async ({ data }: any) => {
              const movement = { id: `mov-${committedMovements.length + 1}`, ...data };
              committedMovements.push(movement);
              return movement;
            }),
          },
          auditLog: {
            create: vi.fn(async ({ data }: any) => {
              const audit = { id: `audit-${committedAudits.length + 1}`, ...data };
              committedAudits.push(audit);
              return audit;
            }),
          },
        };

        return await callback(tx);
      });

      // Token assinado para a sessão de teste
      const validToken = await signToken({
        sub: userSub,
        sectorId,
        roleId: 'role-enfermeiro',
      });

      // Dispara 10 requisições simultâneas de saída de 25 unidades cada (total pretendido: 250 unidades)
      const numRequests = 10;
      const requestedQtyPerCall = 25;

      const requests = Array.from({ length: numRequests }, () => {
        return new NextRequest('http://localhost:3000/api/inventory/exit', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${validToken}`,
          },
          body: JSON.stringify({
            productId,
            quantity: requestedQtyPerCall,
            reason: 'Saída concorrente de emergência',
          }),
        });
      });

      const responses = await Promise.all(requests.map(req => exitRoute(req, {})));
      const results = await Promise.all(responses.map(async res => ({
        status: res.status,
        body: await res.json(),
      })));
      const successfulResponses = results.filter(r => r.status === 201);
      const rejectedResponses = results.filter(r => r.status === 400);

      // Saldo inicial = 100, pedidos de 25 => Exatamente 4 aprovados, 6 rejeitados
      expect(successfulResponses).toHaveLength(4);
      expect(rejectedResponses).toHaveLength(6);

      // Mensagem de rejeição deve ser consistente
      rejectedResponses.forEach(r => {
        expect(r.body.error).toBe('Saldo insuficiente em estoque');
      });

      // Propriedade de Integridade: saldo final >= 0
      expect(databaseStock.quantity).toBeGreaterThanOrEqual(0);
      expect(databaseStock.quantity).toBe(0);

      // Equação de Conservação: total debitado + saldo final = saldo inicial
      const totalDebited = successfulResponses.length * requestedQtyPerCall;
      expect(totalDebited + databaseStock.quantity).toBe(initialQuantity);

      // Verificação de que operações rejeitadas NÃO geram movimentação nem auditoria falsa
      expect(committedMovements).toHaveLength(4);
      expect(committedAudits).toHaveLength(4);
    });

    it('Cenário Concorrente 2: 10 requisições simultâneas de 15 unidades sobre saldo inicial de 50 (sobra de 5)', async () => {
      const userSub = crypto.randomUUID();
      const sectorId = crypto.randomUUID();
      const productId = crypto.randomUUID();
      const stockId = crypto.randomUUID();

      const initialQuantity = 50;
      const databaseStock = {
        id: stockId,
        productId,
        sectorId,
        batchId: null,
        quantity: initialQuantity,
      };

      const committedMovements: any[] = [];
      const committedAudits: any[] = [];

      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        id: userSub,
        status: UserStatus.ATIVO,
        roleId: 'role-enfermeiro',
      } as any);

      vi.spyOn(prisma.rolePermission, 'findFirst').mockResolvedValue({ id: 'perm-stock' } as any);

      vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        const tx = {
          stock: {
            findUnique: vi.fn(async () => ({ ...databaseStock })),
            updateMany: vi.fn(async ({ where, data }: any) => {
              const decrementAmount = data.quantity.decrement;
              if (databaseStock.quantity >= decrementAmount && where.quantity.gte <= databaseStock.quantity) {
                databaseStock.quantity -= decrementAmount;
                return { count: 1 };
              }
              return { count: 0 };
            }),
            findUniqueOrThrow: vi.fn(async () => ({ ...databaseStock })),
          },
          stockMovement: {
            create: vi.fn(async ({ data }: any) => {
              const movement = { id: `mov-${committedMovements.length + 1}`, ...data };
              committedMovements.push(movement);
              return movement;
            }),
          },
          auditLog: {
            create: vi.fn(async ({ data }: any) => {
              const audit = { id: `audit-${committedAudits.length + 1}`, ...data };
              committedAudits.push(audit);
              return audit;
            }),
          },
        };

        return await callback(tx);
      });

      const validToken = await signToken({
        sub: userSub,
        sectorId,
        roleId: 'role-enfermeiro',
      });

      const numRequests = 10;
      const requestedQtyPerCall = 15;

      const requests = Array.from({ length: numRequests }, () => {
        return new NextRequest('http://localhost:3000/api/inventory/exit', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${validToken}`,
          },
          body: JSON.stringify({
            productId,
            quantity: requestedQtyPerCall,
            reason: 'Saída concorrente com resto',
          }),
        });
      });

      const responses = await Promise.all(requests.map(req => exitRoute(req, {})));
      const results = await Promise.all(responses.map(async res => ({
        status: res.status,
        body: await res.json(),
      })));

      const successfulResponses = results.filter(r => r.status === 201);
      const rejectedResponses = results.filter(r => r.status === 400);

      // Saldo inicial 50, retiradas de 15: 3 * 15 = 45 consumidas, 5 restantes
      expect(successfulResponses).toHaveLength(3);
      expect(rejectedResponses).toHaveLength(7);

      expect(databaseStock.quantity).toBe(5);
      expect(databaseStock.quantity).toBeGreaterThanOrEqual(0);

      const totalDebited = successfulResponses.length * requestedQtyPerCall;
      expect(totalDebited + databaseStock.quantity).toBe(initialQuantity);

      expect(committedMovements).toHaveLength(3);
      expect(committedAudits).toHaveLength(3);
    });
  });

  describe('4. Concorrência Atômica de Atendimento de Solicitações (DEM-003)', () => {
    beforeEach(() => {
      process.env.JWT_SECRET = 'segredo-de-teste-super-seguro-com-mais-de-32-caracteres!';
      vi.restoreAllMocks();
    });

    it('Duplo Atendimento Concorrente: Apenas a primeira requisição atende a solicitação via updateMany condicional', async () => {
      const userSub = '11111111-1111-1111-1111-111111111111';
      const supplyingSectorId = '22222222-2222-2222-2222-222222222222';
      const requestingSectorId = '33333333-3333-3333-3333-333333333333';
      const requestId = '44444444-4444-4444-4444-444444444444';
      const productId = '55555555-5555-5555-5555-555555555555';

      let currentRequestStatus: RequestStatus = RequestStatus.PENDENTE;
      let supplyingStockQty = 100;

      vi.spyOn(prisma.sectorRequest, 'findUnique').mockResolvedValue({
        id: requestId,
        status: RequestStatus.PENDENTE,
        supplyingSectorId,
        requestingSectorId,
        items: [
          {
            id: 'item-1',
            requestId,
            productId,
            requestedQuantity: 20,
            product: { name: 'Soro Fisiológico' },
          },
        ],
        requestingSector: { name: 'Enfermaria' },
        supplyingSector: { name: 'Farmácia' },
      } as any);

      vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
        id: userSub,
        status: UserStatus.ATIVO,
        role: { name: 'FARMACEUTICO' },
      } as any);

      vi.spyOn(prisma, '$transaction').mockImplementation(async (callback: any) => {
        const tx = {
          sectorRequest: {
            updateMany: vi.fn(async ({ where, data }: any) => {
              if (where.status.in.includes(currentRequestStatus)) {
                currentRequestStatus = data.status;
                return { count: 1 };
              }
              return { count: 0 };
            }),
            findUniqueOrThrow: vi.fn(async () => ({
              id: requestId,
              status: currentRequestStatus,
              items: [],
              requestingSector: { name: 'Enfermaria' },
              supplyingSector: { name: 'Farmácia' },
            })),
          },
          stock: {
            findUnique: vi.fn(async () => ({
              id: 'stock-supplying',
              productId,
              sectorId: supplyingSectorId,
              quantity: supplyingStockQty,
            })),
            updateMany: vi.fn(async ({ data }: any) => {
              supplyingStockQty -= data.quantity.decrement;
              return { count: 1 };
            }),
            findUniqueOrThrow: vi.fn(async () => ({
              id: 'stock-supplying',
              quantity: supplyingStockQty,
            })),
            upsert: vi.fn(async () => ({
              id: 'stock-requesting',
              quantity: 20,
            })),
          },
          stockMovement: {
            create: vi.fn(async () => ({ id: 'mov-1' })),
          },
          sectorRequestItem: {
            update: vi.fn(async () => ({ id: 'item-1' })),
          },
          auditLog: {
            create: vi.fn(async () => ({ id: 'audit-1' })),
          },
        };

        return await callback(tx);
      });

      const validToken = await signToken({
        sub: userSub,
        sectorId: supplyingSectorId,
        roleId: 'role-farmacia',
      });

      // Dispara 2 requisições simultâneas para atender a mesma solicitação
      const req1 = new NextRequest(`http://localhost:3000/api/inventory/requests/${requestId}/attend`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${validToken}` },
      });
      const req2 = new NextRequest(`http://localhost:3000/api/inventory/requests/${requestId}/attend`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${validToken}` },
      });

      const params = Promise.resolve({ id: requestId });
      const [res1, res2] = await Promise.all([
        attendRoute(req1, { params }),
        attendRoute(req2, { params }),
      ]);

      const statuses = [res1.status, res2.status].sort();
      // Uma requisição deve ter sucesso (200) e a outra deve ser rejeitada com 409 Conflict
      expect(statuses).toEqual([200, 409]);
      expect(currentRequestStatus).toBe(RequestStatus.ATENDIDA);
    });
  });
});
