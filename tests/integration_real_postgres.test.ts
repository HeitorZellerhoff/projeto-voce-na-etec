import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { NextRequest } from 'next/server';
import { neonConfig } from '@neondatabase/serverless';
import ws from 'ws';
import net from 'node:net';
import { prisma } from '../src/lib/prisma';
import { signToken } from '../src/lib/auth/jwt';
import { verifyPassword } from '../src/lib/auth/crypto';
import { POST as exitRoute } from '../src/app/api/inventory/exit/route';
import { POST as forgotPasswordRoute } from '../src/app/api/auth/forgot-password/route';
import { POST as resetPasswordRoute } from '../src/app/api/auth/reset-password/route';

async function isProxyAvailable(port = 5433, host = '127.0.0.1', timeoutMs = 250): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    socket.setTimeout(timeoutMs);
    socket.once('connect', () => {
      socket.destroy();
      resolve(true);
    });
    socket.once('timeout', () => {
      socket.destroy();
      resolve(false);
    });
    socket.once('error', () => {
      socket.destroy();
      resolve(false);
    });
    socket.connect(port, host);
  });
}

const isDbAvailable = await isProxyAvailable(5433, '127.0.0.1');

if (isDbAvailable) {
  // Configuração do driver Neon para encaminhar conexões WebSocket para o proxy local PostgreSQL
  neonConfig.webSocketConstructor = ws;
  neonConfig.wsProxy = (host, port) => `127.0.0.1:5433/v2?address=${host}:${port}`;
  neonConfig.useSecureWebSocket = false;
  neonConfig.pipelineTLS = false;
}

process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://postgres:postgres@127.0.0.1:5432/hospital_test';
process.env.JWT_SECRET = 'segredo-de-teste-super-seguro-com-mais-de-32-caracteres!';

describe.skipIf(!isDbAvailable)('DEM-021: Validação de Integração Real com PostgreSQL (Sem Mocks de Persistência)', () => {
  let farmaciaSector: any;
  let farmaceuticoUser: any;
  let dipironaProduct: any;
  let testBatch: any;
  let stockIdA: string;
  let stockIdB: string;

  beforeAll(async () => {
    // Localiza registros reais criados pela migration/seed
    farmaciaSector = await prisma.sector.findFirstOrThrow({ where: { code: 'FARMACIA' } });
    farmaceuticoUser = await prisma.user.findFirstOrThrow({ where: { email: 'farmacia@hospital.com' } });
    dipironaProduct = await prisma.product.findFirstOrThrow({ where: { code: 'MED-001' } });

    // Cria lote de teste para satisfazer a chave composta de lote
    testBatch = await prisma.productBatch.create({
      data: {
        productId: dipironaProduct.id,
        batchNumber: `LOTE-INT-${Date.now()}`,
        expirationDate: new Date('2028-12-31'),
        manufacturer: 'Laboratório Farmacêutico Nacional',
      },
    });
  });

  afterAll(async () => {
    if (testBatch) {
      await prisma.stockMovement.deleteMany({ where: { batchId: testBatch.id } });
      await prisma.stock.deleteMany({ where: { batchId: testBatch.id } });
      await prisma.productBatch.delete({ where: { id: testBatch.id } });
    }
    await prisma.$disconnect();
  });

  describe('1. Verificação da Constraint stock_quantity_non_negative no PostgreSQL Real', () => {
    it('deve confirmar a presença da constraint CHECK no catálogo pg_constraint', async () => {
      const constraints: any[] = await prisma.$queryRaw`
        SELECT conname::text as conname, contype::text as contype, pg_get_constraintdef(oid)::text as definition
        FROM pg_constraint
        WHERE conrelid = 'public."Stock"'::regclass
          AND conname = 'stock_quantity_non_negative';
      `;

      expect(constraints).toHaveLength(1);
      expect(constraints[0].conname).toBe('stock_quantity_non_negative');
      expect(constraints[0].contype).toBe('c'); // 'c' = CHECK constraint
      expect(constraints[0].definition).toContain('quantity >= 0');
    });

    it('deve rejeitar fisicamente uma tentativa de definir quantidade negativa via UPDATE', async () => {
      // Cria registro de estoque temporário para teste
      const tempStock = await prisma.stock.create({
        data: {
          productId: dipironaProduct.id,
          sectorId: farmaciaSector.id,
          batchId: testBatch.id,
          quantity: 20,
        },
      });

      // Tenta forçar valor negativo via SQL direto para exercitar o motor relacional PostgreSQL
      let dbError: any = null;
      try {
        await prisma.$executeRaw`
          UPDATE "Stock"
          SET "quantity" = -10
          WHERE "id" = ${tempStock.id}::uuid;
        `;
      } catch (err) {
        dbError = err;
      }

      expect(dbError).not.toBeNull();
      // Código de erro PostgreSQL 23514 = check_violation
      expect(dbError.message).toMatch(/stock_quantity_non_negative/i);

      // Confirma que o valor no banco permaneceu íntegro (20)
      const stockAfter = await prisma.stock.findUniqueOrThrow({ where: { id: tempStock.id } });
      expect(stockAfter.quantity).toBe(20);

      // Limpeza
      await prisma.stock.delete({ where: { id: tempStock.id } });
    });

    it('deve rejeitar fisicamente uma tentativa de inserir novo registro com quantidade negativa via INSERT', async () => {
      let dbError: any = null;
      try {
        await prisma.$executeRaw`
          INSERT INTO "Stock" ("id", "productId", "sectorId", "batchId", "quantity", "createdAt", "updatedAt")
          VALUES (gen_random_uuid(), ${dipironaProduct.id}::uuid, ${farmaciaSector.id}::uuid, ${testBatch.id}::uuid, -5, NOW(), NOW());
        `;
      } catch (err) {
        dbError = err;
      }

      expect(dbError).not.toBeNull();
      expect(dbError.message).toMatch(/stock_quantity_non_negative/i);
    });
  });

  describe('2. Concorrência Real no PostgreSQL — Cenário Obrigatório A (100 / 25)', () => {
    it('executa 10 requisições simultâneas de 25 sobre saldo 100 resultando em exatamente 4 aprovadas e 6 rejeitadas', async () => {
      // 1. Prepara estoque real no PostgreSQL com saldo 100
      const initialStock = await prisma.stock.create({
        data: {
          productId: dipironaProduct.id,
          sectorId: farmaciaSector.id,
          batchId: testBatch.id,
          quantity: 100,
        },
      });
      stockIdA = initialStock.id;

      // 2. Gera token JWT real para o usuário Farmacêutico
      const token = await signToken({
        sub: farmaceuticoUser.id,
        sectorId: farmaciaSector.id,
        roleId: farmaceuticoUser.roleId,
      });

      // 3. Monta 10 requisições HTTP reais apontando para o route handler POST /api/inventory/exit
      const numRequests = 10;
      const requestedQty = 25;

      const requests = Array.from({ length: numRequests }, () => {
        return new NextRequest('http://localhost:3000/api/inventory/exit', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            productId: dipironaProduct.id,
            batchId: testBatch.id,
            quantity: requestedQty,
            reason: 'Saída concorrente real DEM-021 Cenário A',
          }),
        });
      });

      // 4. Dispara simultaneamente via Promise.all atravessando: Handler -> Prisma -> PostgreSQL Real
      const responses = await Promise.all(requests.map(req => exitRoute(req, {})));
      const results = await Promise.all(responses.map(async res => ({
        status: res.status,
        body: await res.json(),
      })));

      const approved = results.filter(r => r.status === 201);
      const rejected = results.filter(r => r.status === 400);

      // Verificação 1: Exatamente 4 aprovadas e 6 rejeitadas
      expect(approved).toHaveLength(4);
      expect(rejected).toHaveLength(6);

      // Verificação 2: Consulta direta no PostgreSQL para validar o saldo final
      const finalStock = await prisma.stock.findUniqueOrThrow({ where: { id: stockIdA } });
      expect(finalStock.quantity).toBe(0);
      expect(finalStock.quantity).toBeGreaterThanOrEqual(0);

      // Verificação 3: Movimentações registradas no PostgreSQL
      const movements = await prisma.stockMovement.findMany({
        where: {
          sectorId: farmaciaSector.id,
          productId: dipironaProduct.id,
          batchId: testBatch.id,
          reason: 'Saída concorrente real DEM-021 Cenário A',
        },
      });
      expect(movements).toHaveLength(4);
      const totalMoved = movements.reduce((acc, m) => acc + m.quantity, 0);
      expect(totalMoved).toBe(100);

      // Verificação 4: Logs de auditoria no PostgreSQL
      const auditLogs = await prisma.auditLog.findMany({
        where: {
          sectorId: farmaciaSector.id,
          action: 'INVENTORY_EXIT',
          entityId: { in: movements.map(m => m.id) },
        },
      });
      expect(auditLogs).toHaveLength(4);

      // Verificação 5: Conservação matemática estrita: Saldo Inicial (100) = Movimentado (100) + Saldo Final (0)
      expect(totalMoved + finalStock.quantity).toBe(100);
    });
  });

  describe('3. Concorrência Real no PostgreSQL — Cenário Obrigatório B (Saldo 50 / 10 x 15)', () => {
    it('executa 10 requisições simultâneas de 15 sobre saldo 50 resultando em exatamente 3 aprovadas e saldo remanescente 5', async () => {
      // 1. Cria segundo lote para isolar o estoque B
      const batchB = await prisma.productBatch.create({
        data: {
          productId: dipironaProduct.id,
          batchNumber: `LOTE-INT-B-${Date.now()}`,
          expirationDate: new Date('2029-06-30'),
        },
      });

      // 2. Prepara estoque real no PostgreSQL com saldo 50
      const initialStock = await prisma.stock.create({
        data: {
          productId: dipironaProduct.id,
          sectorId: farmaciaSector.id,
          batchId: batchB.id,
          quantity: 50,
        },
      });
      stockIdB = initialStock.id;

      const token = await signToken({
        sub: farmaceuticoUser.id,
        sectorId: farmaciaSector.id,
        roleId: farmaceuticoUser.roleId,
      });

      // 10 requisições de 15 cada (demanda pretendida: 150 > 50 disponível)
      const requests = Array.from({ length: 10 }, () => {
        return new NextRequest('http://localhost:3000/api/inventory/exit', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
          },
          body: JSON.stringify({
            productId: dipironaProduct.id,
            batchId: batchB.id,
            quantity: 15,
            reason: 'Saída concorrente real DEM-021 Cenário B',
          }),
        });
      });

      const responses = await Promise.all(requests.map(req => exitRoute(req, {})));
      const results = await Promise.all(responses.map(async res => ({
        status: res.status,
        body: await res.json(),
      })));

      const approved = results.filter(r => r.status === 201);
      const rejected = results.filter(r => r.status === 400);

      // Apenas 3 requisições podem passar (3 x 15 = 45 <= 50)
      expect(approved).toHaveLength(3);
      expect(rejected).toHaveLength(7);

      // Consulta no PostgreSQL real: Saldo final deve ser 5
      const finalStock = await prisma.stock.findUniqueOrThrow({ where: { id: stockIdB } });
      expect(finalStock.quantity).toBe(5);

      const movements = await prisma.stockMovement.findMany({
        where: {
          sectorId: farmaciaSector.id,
          productId: dipironaProduct.id,
          batchId: batchB.id,
          reason: 'Saída concorrente real DEM-021 Cenário B',
        },
      });
      expect(movements).toHaveLength(3);
      const totalMoved = movements.reduce((acc, m) => acc + m.quantity, 0);
      expect(totalMoved).toBe(45);

      // Conservação matemática: 45 debitado + 5 restante = 50 inicial
      expect(totalMoved + finalStock.quantity).toBe(50);

      // Limpeza batchB
      await prisma.stockMovement.deleteMany({ where: { batchId: batchB.id } });
      await prisma.stock.deleteMany({ where: { batchId: batchB.id } });
      await prisma.productBatch.delete({ where: { id: batchB.id } });
    });
  });

  describe('4. Reset de Senha de Ponta a Ponta com PostgreSQL Real (DEM-018)', () => {
    it('executa o ciclo completo de solicitação, persistência de hash SHA-256, consumo atômico e prevenção de replay', async () => {
      // Cria usuário de teste com status ATIVO
      const testUser = await prisma.user.create({
        data: {
          name: 'Colaborador Teste Reset',
          registration: `RESET-${Date.now()}`,
          email: `colaborador.reset.${Date.now()}@hospital.com`,
          passwordHash: '$2a$10$abcdefghijklmnopqrstuvwxyz012345',
          status: 'ATIVO',
          sectorId: farmaciaSector.id,
          roleId: farmaceuticoUser.roleId,
          mustChangePassword: true,
        },
      });

      // 1. Invocação real de forgot-password
      const forgotReq = new NextRequest('http://localhost:3000/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: testUser.email }),
      });

      const forgotRes = await forgotPasswordRoute(forgotReq);
      expect(forgotRes.status).toBe(202);

      // 2. Consulta no banco PostgreSQL real
      const tokensInDb = await prisma.passwordResetToken.findMany({
        where: { userId: testUser.id },
      });
      expect(tokensInDb).toHaveLength(1);
      const storedRecord = tokensInDb[0];

      // O token armazenado é estritamente um hash SHA-256 de 64 caracteres hexadecimais
      expect(storedRecord.tokenHash).toMatch(/^[a-f0-9]{64}$/);
      expect(storedRecord.usedAt).toBeNull();
      expect(storedRecord.expiresAt.getTime()).toBeGreaterThan(Date.now());

      // 3. Simula consumo com token inválido
      const invalidReq = new NextRequest('http://localhost:3000/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: 'token-completamente-invalido-1234567890',
          newPassword: 'NovaSenhaForte2026@!',
        }),
      });
      const invalidRes = await resetPasswordRoute(invalidReq);
      expect(invalidRes.status).toBe(400);

      // Atualizamos o registro para um hash conhecido para testar a rota real
      const crypto = await import('node:crypto');
      const knownRawToken = 'meu-token-secreto-de-recuperacao-de-64-caracteres-de-entropia-12345';
      const knownHash = crypto.createHash('sha256').update(knownRawToken).digest('hex');

      await prisma.passwordResetToken.update({
        where: { id: storedRecord.id },
        data: { tokenHash: knownHash },
      });

      // 4. Invocação real de reset-password com o token correto
      const resetReq = new NextRequest('http://localhost:3000/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: knownRawToken,
          newPassword: 'NovaSenhaForte2026@!',
        }),
      });

      const resetRes = await resetPasswordRoute(resetReq);
      expect(resetRes.status).toBe(200);

      // 5. Verifica estado final no banco de dados real
      const tokenAfter = await prisma.passwordResetToken.findUniqueOrThrow({ where: { id: storedRecord.id } });
      expect(tokenAfter.usedAt).not.toBeNull(); // Marcado como utilizado

      const userAfter = await prisma.user.findUniqueOrThrow({ where: { id: testUser.id } });
      expect(userAfter.mustChangePassword).toBe(false);

      // Verifica se a nova senha funciona com bcrypt
      const isNewPwValid = await verifyPassword('NovaSenhaForte2026@!', userAfter.passwordHash);
      expect(isNewPwValid).toBe(true);

      // Verifica se a senha antiga foi revogada
      const isOldPwValid = await verifyPassword('SenhaAntiga123!', userAfter.passwordHash);
      expect(isOldPwValid).toBe(false);

      // 6. Prevenção de Replay Attack: Tentar utilizar o MESMO token novamente
      const replayReq = new NextRequest('http://localhost:3000/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: knownRawToken,
          newPassword: 'OutraSenhaTentativa2@!',
        }),
      });
      const replayRes = await resetPasswordRoute(replayReq);
      expect(replayRes.status).toBe(400);
      const replayJson = await replayRes.json();
      expect(replayJson.error).toMatch(/já foi utilizado/i);

      // Limpeza
      await prisma.passwordResetToken.deleteMany({ where: { userId: testUser.id } });
      await prisma.auditLog.deleteMany({ where: { userId: testUser.id } });
      await prisma.user.delete({ where: { id: testUser.id } });
    });
  });
});
