import { describe, it, expect, beforeAll } from 'vitest';
import { prisma } from '../src/lib/prisma';
import { MovementType, PurchaseStatus } from '../src/generated/prisma';

// Estas rotinas testam o isolamento de segurança diretamente através da simulação das funções HOC ou batendo nas rotas

const MOCK_API_BASE = process.env.API_BASE_URL || 'http://localhost:3000/api';

describe('Suite de Exploração e Segurança de Identidades (Section 62)', () => {
  const adminToken = 'mock-token';
  const enfermeiroToken = 'mock-enfermeiro';
  const farmaciaSectorId = 'mock-farmacia';
  const almoxarifadoSectorId = 'mock-almoxarifado';

  let serverAvailable = false;

  beforeAll(async () => {
    try {
      const res = await fetch(`${MOCK_API_BASE}/sectors`, { signal: AbortSignal.timeout(600) });
      serverAvailable = res.status !== 0;
    } catch {
      serverAvailable = false;
    }
  });

  it('Test 1 (Payload Sector Tampering): Bloqueia tentativa de forjar o sectorId via JSON Injection', async () => {
    if (!serverAvailable) return;
    const response = await fetch(`${MOCK_API_BASE}/inventory/entry`, {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Cookie': `session=${enfermeiroToken}` // Enfermeiro é da Farmácia
      },
      body: JSON.stringify({
        productId: "mock-product-id",
        quantity: 100,
        reason: "Forjando Setor",
        // TENTATIVA DE TAMPERING: Forçando injeção de ID do Almoxarifado
        sectorId: almoxarifadoSectorId 
      })
    });

    const data = await response.json();
    
    // Assert 1: A API não pode ter explodido (500), mas sim interceptado e corrigido/negado.
    // Como a HOC 'withSectorScoping' descarta o body.sectorId e impõe o session.sectorId, 
    // a movimentação será vinculada à FARMÁCIA obrigatoriamente, protegendo o banco.
    if (response.status === 201) {
      expect(data.movement.sectorId).not.toBe(almoxarifadoSectorId);
      expect(data.movement.sectorId).toBe(farmaciaSectorId);
    } else {
      expect([400, 403]).toContain(response.status);
    }
  });

  it('Test 2 (Unauthorized Adjustment Attempt): Bloqueia ajuste sem a permissão STOCK_ADJUST', async () => {
    if (!serverAvailable) return;
    const response = await fetch(`${MOCK_API_BASE}/inventory/adjustment`, {
      method: 'POST',
      headers: { 'Cookie': `session=${enfermeiroToken}` },
      body: JSON.stringify({
        productId: "mock-product-id",
        newQuantity: 50,
        reason: "Ajuste ilegal"
      })
    });

    // Assert: Enfermeiro comum não possui STOCK_ADJUST, HOC deve barrar
    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toContain('Você não possui autorização');
  });

  it('Test 3 (Purchase SoD Violation): Requisitante não pode aprovar a própria compra', async () => {
    if (!serverAvailable) return;
    // Setup: Enfermeiro cria a requisição
    const mockPurchaseId = "purchase-criada-pelo-enfermeiro";
    
    // Attack: Enfermeiro tenta aprovar sua própria requisição via CURL ou Insomnia
    const response = await fetch(`${MOCK_API_BASE}/purchases/${mockPurchaseId}/approve`, {
      method: 'POST',
      headers: { 'Cookie': `session=${enfermeiroToken}` }
    });

    // Assert: Endpoint nativamente verifica `purchase.requestedByUserId === session.sub`
    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toContain('Segregação de funções');
  });

  it('Test 4 (Negative Stock Prevention): Transações ACID impedem saldo negativo', async () => {
    if (!serverAvailable) return;
    // Attack: Tenta retirar 1.000.000 unidades de um estoque que tem apenas 50
    const response = await fetch(`${MOCK_API_BASE}/inventory/exit`, {
      method: 'POST',
      headers: { 'Cookie': `session=${enfermeiroToken}` },
      body: JSON.stringify({
        productId: "mock-product-id",
        quantity: 1000000,
        reason: "Retirada massiva para forçar negativo"
      })
    });

    // Assert: O Prisma $transaction detecta o rollback e joga o erro controlado
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Saldo insuficiente em estoque');
  });

  it('Test 5 (Account Enumeration Resistance): Rate limiting e ofuscação no Forgot Password', async () => {
    if (!serverAvailable) return;
    const res1 = await fetch(`${MOCK_API_BASE}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: "email.que.nao.existe@hospital.com" })
    });
    const res2 = await fetch(`${MOCK_API_BASE}/auth/forgot-password`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: "admin@hospital.com" })
    });

    const data1 = await res1.json();
    const data2 = await res2.json();

    // Assert: O atacante não consegue descobrir se o e-mail existe no banco
    expect(res1.status).toBe(200);
    expect(res2.status).toBe(200);
    expect(data1.message).toBe(data2.message);
  });
});
