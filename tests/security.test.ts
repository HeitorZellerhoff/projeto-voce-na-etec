import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock neon for proxy tests
const mockNeonQuery = vi.fn();
vi.mock('@neondatabase/serverless', () => ({
  neon: () => mockNeonQuery,
}));

// Mock dependencies
vi.mock('@/lib/prisma', () => {
  const mockStock = {
    findUnique: vi.fn(),
    updateMany: vi.fn(),
    findUniqueOrThrow: vi.fn(),
    upsert: vi.fn(),
  };
  const mockStockMovement = {
    create: vi.fn(),
  };
  const mockAuditLog = {
    create: vi.fn().mockResolvedValue({ id: 'audit-1' }),
  };
  const mockSector = {
    findUnique: vi.fn(),
  };
  const mockProduct = {
    findUnique: vi.fn(),
  };
  const mockSectorCategory = {
    count: vi.fn(),
    findUnique: vi.fn(),
  };
  const mockPurchase = {
    findUnique: vi.fn(),
    update: vi.fn(),
  };
  const mockUser = {
    findUnique: vi.fn(),
    update: vi.fn(),
  };
  const mockPasswordResetToken = {
    create: vi.fn(),
    updateMany: vi.fn(),
  };
  const mockRolePermission = {
    findFirst: vi.fn(),
  };

  return {
    prisma: {
      stock: mockStock,
      stockMovement: mockStockMovement,
      auditLog: mockAuditLog,
      sector: mockSector,
      product: mockProduct,
      sectorCategory: mockSectorCategory,
      purchase: mockPurchase,
      user: mockUser,
      passwordResetToken: mockPasswordResetToken,
      rolePermission: mockRolePermission,
      $transaction: vi.fn(async (cb: (tx: any) => any) => {
        return cb({
          stock: mockStock,
          stockMovement: mockStockMovement,
          auditLog: mockAuditLog,
          purchase: mockPurchase,
          user: mockUser,
        });
      }),
    },
  };
});

vi.mock('@/lib/auth/session', () => {
  return {
    getSession: vi.fn(),
    destroySession: vi.fn().mockResolvedValue(undefined),
    createSession: vi.fn().mockResolvedValue(undefined),
  };
});

import { prisma } from '@/lib/prisma';
import { getSession } from '@/lib/auth/session';
import { signToken } from '@/lib/auth/jwt';
import { POST as entryRoute } from '@/app/api/inventory/entry/route';
import { POST as exitRoute } from '@/app/api/inventory/exit/route';
import { POST as adjustmentRoute } from '@/app/api/inventory/adjustment/route';
import { POST as approvePurchaseRoute } from '@/app/api/purchases/[id]/approve/route';
import { POST as forgotPasswordRoute } from '@/app/api/auth/forgot-password/route';
import { proxy } from '@/proxy';
import { withSectorScoping } from '@/lib/security/guards';

describe('Suite de Exploração e Segurança de Identidades (DEM-017 & DEM-019)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.JWT_SECRET = 'segredo-de-teste-super-seguro-com-mais-de-32-caracteres!';
    process.env.DATABASE_URL = 'postgresql://test:test@neon.tech/test';
  });

  it('Test 1 (Payload Sector Tampering): Bloqueia tentativa de forjar o sectorId via JSON Injection', async () => {
    const userSub = crypto.randomUUID();
    const farmaciaSectorId = crypto.randomUUID();
    const almoxarifadoSectorId = crypto.randomUUID();
    const productId = crypto.randomUUID();

    vi.mocked(getSession).mockResolvedValue({
      sub: userSub,
      roleId: crypto.randomUUID(),
      sectorId: farmaciaSectorId,
    });

    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: userSub,
      status: 'ATIVO',
      roleId: 'role-enfermeiro',
    } as any);

    vi.mocked(prisma.rolePermission.findFirst).mockResolvedValue({ id: 'rp-manage' } as any);

    vi.mocked(prisma.product.findUnique).mockResolvedValue({
      id: productId,
      name: 'Luvas de Procedimento',
      categoryId: crypto.randomUUID(),
    } as any);

    vi.mocked(prisma.sectorCategory.count).mockResolvedValue(0);

    vi.mocked(prisma.stock.upsert).mockResolvedValue({
      id: 'stock-1',
      productId,
      sectorId: farmaciaSectorId,
      quantity: 100,
    } as any);

    vi.mocked(prisma.stockMovement.create).mockResolvedValue({
      id: 'movement-1',
      productId,
      sectorId: farmaciaSectorId,
      quantity: 100,
    } as any);

    const req = new NextRequest('http://localhost:3000/api/inventory/entry', {
      method: 'POST',
      body: JSON.stringify({
        productId,
        quantity: 100,
        reason: 'Forjando Setor',
        sectorId: almoxarifadoSectorId,
      }),
    });

    const response = await entryRoute(req, {});
    expect(response.status).toBe(201);
    const data = await response.json();

    // withSectorScoping expurgou o sectorId injetado e impôs o da sessão (farmaciaSectorId)
    expect(data.movement.sectorId).not.toBe(almoxarifadoSectorId);
    expect(data.movement.sectorId).toBe(farmaciaSectorId);
  });

  it('Test 1B (Query Sector Tampering): Intercepta e remove sectorId injetado na URL Query String', async () => {
    const userSub = crypto.randomUUID();
    const enfermariaSectorId = crypto.randomUUID();
    const farmaciaSectorId = crypto.randomUUID();

    vi.mocked(getSession).mockResolvedValue({
      sub: userSub,
      roleId: crypto.randomUUID(),
      sectorId: enfermariaSectorId,
    });

    let capturedSectorId: string | null = null;
    const testHandler = withSectorScoping(async (req, ctx, session) => {
      capturedSectorId = session.sectorId;
      return new Response(JSON.stringify({ ok: true, sectorId: session.sectorId }), { status: 200 });
    });

    const req = new NextRequest(`http://localhost:3000/api/inventory/items?sectorId=${farmaciaSectorId}`, {
      method: 'GET',
    });

    const res = await testHandler(req, {});
    expect(res.status).toBe(200);
    expect(capturedSectorId).toBe(enfermariaSectorId);
    expect(capturedSectorId).not.toBe(farmaciaSectorId);
  });

  it('Test 2 (Unauthorized Adjustment Attempt): Bloqueia ajuste sem a permissão STOCK_ADJUST', async () => {
    const userSub = crypto.randomUUID();
    const sectorId = crypto.randomUUID();
    const productId = crypto.randomUUID();

    vi.mocked(getSession).mockResolvedValue({
      sub: userSub,
      roleId: crypto.randomUUID(),
      sectorId,
    });

    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: userSub,
      status: 'ATIVO',
      roleId: 'role-enfermeiro',
    } as any);

    // Usuário NÃO tem a permissão STOCK_ADJUST
    vi.mocked(prisma.rolePermission.findFirst).mockResolvedValue(null);

    const req = new NextRequest('http://localhost:3000/api/inventory/adjustment', {
      method: 'POST',
      body: JSON.stringify({
        productId,
        newQuantity: 50,
        reason: 'Ajuste ilegal',
      }),
    });

    const response = await adjustmentRoute(req, {});
    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toContain('Acesso negado: Requer permissão estrita');
  });

  it('Test 3 (Purchase SoD Violation): Requisitante não pode aprovar a própria compra', async () => {
    const userSub = crypto.randomUUID();
    const purchaseId = crypto.randomUUID();

    vi.mocked(getSession).mockResolvedValue({
      sub: userSub,
      roleId: crypto.randomUUID(),
      sectorId: crypto.randomUUID(),
    });

    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: userSub,
      status: 'ATIVO',
      roleId: 'role-compras',
    } as any);

    vi.mocked(prisma.rolePermission.findFirst).mockResolvedValue({ id: 'rp-approve' } as any);

    // Compra onde requestedByUserId é o mesmo userSub da sessão ativa
    vi.mocked(prisma.purchase.findUnique).mockResolvedValue({
      id: purchaseId,
      status: 'PENDENTE_APROVACAO',
      requestedByUserId: userSub,
      totalAmount: 5000,
    } as any);

    const req = new NextRequest(`http://localhost:3000/api/purchases/${purchaseId}/approve`, {
      method: 'POST',
    });

    const params = Promise.resolve({ id: purchaseId });
    const response = await approvePurchaseRoute(req, { params });

    expect(response.status).toBe(403);
    const data = await response.json();
    expect(data.error).toMatch(/segregação de funções/i);
  });

  it('Test 4 (Negative Stock Prevention): Transações ACID impedem saldo negativo', async () => {
    const userSub = crypto.randomUUID();
    const sectorId = crypto.randomUUID();
    const productId = crypto.randomUUID();

    vi.mocked(getSession).mockResolvedValue({
      sub: userSub,
      roleId: crypto.randomUUID(),
      sectorId,
    });

    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: userSub,
      status: 'ATIVO',
      roleId: 'role-enfermeiro',
    } as any);

    vi.mocked(prisma.rolePermission.findFirst).mockResolvedValue({ id: 'rp-manage' } as any);

    // Estoque com saldo de apenas 50
    vi.mocked(prisma.stock.findUnique).mockResolvedValue({
      id: 'stock-1',
      productId,
      sectorId,
      quantity: 50,
    } as any);

    // Tentativa de retirar 1.000.000 unidades
    const req = new NextRequest('http://localhost:3000/api/inventory/exit', {
      method: 'POST',
      body: JSON.stringify({
        productId,
        quantity: 1000000,
        reason: 'Retirada massiva para forçar negativo',
      }),
    });

    const response = await exitRoute(req, {});
    expect(response.status).toBe(400);
    const data = await response.json();
    expect(data.error).toBe('Saldo insuficiente em estoque');
  });

  it('Test 5 (Account Enumeration Resistance): Resposta uniforme no Forgot Password', async () => {
    vi.mocked(prisma.user.findUnique).mockImplementation((async ({ where }: any) => {
      if (where.email === 'admin@hospital.com') {
        return {
          id: 'admin-uuid',
          email: 'admin@hospital.com',
          sectorId: 'sector-uuid',
          status: 'ATIVO',
        };
      }
      return null;
    }) as any);

    const req1 = new NextRequest('http://localhost:3000/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: 'email.que.nao.existe@hospital.com' }),
    });

    const req2 = new NextRequest('http://localhost:3000/api/auth/forgot-password', {
      method: 'POST',
      body: JSON.stringify({ email: 'admin@hospital.com' }),
    });

    const res1 = await forgotPasswordRoute(req1);
    const res2 = await forgotPasswordRoute(req2);

    const data1 = await res1.json();
    const data2 = await res2.json();

    expect(res1.status).toBe(202);
    expect(res2.status).toBe(202);
    expect(data1.message).toBe(data2.message);
  });

  it('Test 6 (Real-Time Revocation): Bloqueio em tempo real rejeita sessão mesmo com JWT válido', async () => {
    const userSub = crypto.randomUUID();
    const validToken = await signToken({
      sub: userSub,
      sectorId: crypto.randomUUID(),
      roleId: crypto.randomUUID(),
    });

    // Banco de dados informa que o usuário foi BLOQUEADO
    mockNeonQuery.mockResolvedValueOnce([
      {
        status: 'BLOQUEADO',
        mustChangePassword: false,
        sectorCode: 'farmacia',
        roleName: 'FARMACEUTICO',
      },
    ]);

    const req = new NextRequest('http://localhost:3000/api/inventory/entry', {
      headers: {
        cookie: `session=${validToken}`,
      },
    });

    const res = await proxy(req);
    expect(res.status).toBe(403);
    const data = await res.json();
    expect(data.error).toMatch(/BLOQUEADO/i);
  });

  it('Test 7 (Proxy Fail-Close on Database Failure for APIs): Retorna 503 Fail-Close quando Neon/DB está indisponível', async () => {
    const validToken = await signToken({
      sub: 'user-sub-1',
      sectorId: 'sector-1',
      roleId: 'role-1',
    });

    // Simula falha catastrófica de rede/timeout com o banco de dados Neon
    mockNeonQuery.mockRejectedValueOnce(new Error('Connection timeout to neon postgres server'));

    const req = new NextRequest('http://localhost:3000/api/inventory/items', {
      headers: {
        cookie: `session=${validToken}`,
      },
    });

    const res = await proxy(req);
    // Deve falhar fechado com 503 (Fail-Close)
    expect(res.status).toBe(503);
    const json = await res.json();
    expect(json.error).toMatch(/Serviço de autenticação temporariamente indisponível/i);
  });

  it('Test 8 (Proxy Fail-Close on Database Failure for Dashboard): Redireciona com 303 para login com mensagem segura', async () => {
    const validToken = await signToken({
      sub: 'user-sub-1',
      sectorId: 'sector-1',
      roleId: 'role-1',
    });

    mockNeonQuery.mockRejectedValueOnce(new Error('Neon database unreachable'));

    const req = new NextRequest('http://localhost:3000/dashboard/farmacia', {
      headers: {
        cookie: `session=${validToken}`,
      },
    });

    const res = await proxy(req);
    // Deve falhar fechado com redirecionamento para login (Fail-Close)
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toContain('/login?error=Servi%C3%A7o%20temporariamente%20indispon%C3%ADvel');
  });

  it('Test 9 (Cross-Sector Frontend Guard): Usuário da Farmácia é redirecionado ao tentar acessar /dashboard/compras', async () => {
    const validToken = await signToken({
      sub: 'user-farmaceutico',
      sectorId: 'sector-farmacia',
      roleId: 'role-farmacia',
    });

    mockNeonQuery.mockResolvedValueOnce([
      {
        status: 'ATIVO',
        mustChangePassword: false,
        sectorCode: 'farmacia',
        roleName: 'FARMACEUTICO',
      },
    ]);

    const req = new NextRequest('http://localhost:3000/dashboard/compras', {
      headers: {
        cookie: `session=${validToken}`,
      },
    });

    const res = await proxy(req);
    expect(res.status).toBe(303);
    expect(res.headers.get('location')).toContain('/403-acesso-negado');
  });
});
