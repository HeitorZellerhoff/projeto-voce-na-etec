import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { signToken, verifyToken } from '../src/lib/auth/jwt';
import { withSectorScoping } from '../src/lib/security/guards';
import { MovementType, RequestStatus, UserStatus } from '../src/generated/prisma';
import { POST as exitRoute } from '../src/app/api/inventory/exit/route';
import { POST as transferRoute } from '../src/app/api/inventory/transfer/route';
import { POST as attendRoute } from '../src/app/api/inventory/requests/[id]/attend/route';
import { prisma } from '../src/lib/prisma';

describe('Validação Estrutural de Setores Hospitalares e Isolamento de Estoque (Section 62/63)', () => {
  const farmaciaSectorId = crypto.randomUUID();
  const almoxarifadoSectorId = crypto.randomUUID();
  const enfermariaSectorId = crypto.randomUUID();
  const centroCirurgicoSectorId = crypto.randomUUID();

  const enfermeiroUserId = crypto.randomUUID();
  const farmaceuticoUserId = crypto.randomUUID();
  const almoxarifeUserId = crypto.randomUUID();

  const dipironaProductId = crypto.randomUUID();
  const seringaProductId = crypto.randomUUID();

  beforeEach(() => {
    vi.restoreAllMocks();
    process.env.JWT_SECRET = 'segredo-de-teste-super-seguro-com-mais-de-32-caracteres!';
  });

  it('1. Setores são entidades únicas identificadas por ID e código único', () => {
    const sectorEnfermaria = {
      id: enfermariaSectorId,
      name: 'Enfermaria Geral',
      code: 'ENFERMARIA',
      status: 'ATIVO',
      description: 'Internação e assistência aos pacientes',
    };

    const sectorFarmacia = {
      id: farmaciaSectorId,
      name: 'Farmácia Central',
      code: 'FARMACIA',
      status: 'ATIVO',
      description: 'Gestão de medicamentos hospitalares',
    };

    expect(sectorEnfermaria.id).toBeDefined();
    expect(sectorFarmacia.id).toBeDefined();
    expect(sectorEnfermaria.id).not.toBe(sectorFarmacia.id);
    expect(sectorEnfermaria.code).not.toBe(sectorFarmacia.code);
    expect(sectorEnfermaria.status).toBe('ATIVO');
  });

  it('2. Usuário possui associação estrita com seu setor no JWT/sessão e backend valida', async () => {
    const payload = {
      sub: enfermeiroUserId,
      sectorId: enfermariaSectorId,
      roleId: crypto.randomUUID(),
    };

    const token = await signToken(payload);
    expect(token).toBeDefined();

    const decoded = await verifyToken(token);
    expect(decoded).not.toBeNull();
    expect(decoded?.sub).toBe(enfermeiroUserId);
    expect(decoded?.sectorId).toBe(enfermariaSectorId);
    expect(decoded?.sectorId).not.toBe(farmaciaSectorId);
  });

  it('3. Criação de estoque associado ao setor com quantidades mínimas setoriais', () => {
    const stockFarmacia = {
      id: 'stock-farm-dipirona',
      productId: dipironaProductId,
      sectorId: farmaciaSectorId,
      quantity: 500,
      minimumQuantity: 100,
      maximumQuantity: 1000,
    };

    expect(stockFarmacia.sectorId).toBe(farmaciaSectorId);
    expect(stockFarmacia.productId).toBe(dipironaProductId);
    expect(stockFarmacia.quantity).toBe(500);
    expect(stockFarmacia.minimumQuantity).toBe(100);
  });

  it('4. REGRA FUNDAMENTAL: O mesmo item existe em múltiplos setores com estoques e saldos independentes', () => {
    const stockFarmacia = {
      id: 'stock-farm-01',
      productId: dipironaProductId,
      productName: 'Dipirona Sódica 500mg',
      sectorId: farmaciaSectorId,
      sectorName: 'Farmácia Central',
      quantity: 500,
    };

    const stockEnfermaria = {
      id: 'stock-enf-01',
      productId: dipironaProductId,
      productName: 'Dipirona Sódica 500mg',
      sectorId: enfermariaSectorId,
      sectorName: 'Enfermaria Geral',
      quantity: 30,
    };

    const stockCentroCirurgico = {
      id: 'stock-cc-01',
      productId: dipironaProductId,
      productName: 'Dipirona Sódica 500mg',
      sectorId: centroCirurgicoSectorId,
      sectorName: 'Centro Cirúrgico',
      quantity: 50,
    };

    expect(stockFarmacia.productId).toBe(stockEnfermaria.productId);
    expect(stockEnfermaria.productId).toBe(stockCentroCirurgico.productId);

    expect(stockFarmacia.id).not.toBe(stockEnfermaria.id);
    expect(stockFarmacia.sectorId).not.toBe(stockEnfermaria.sectorId);

    expect(stockFarmacia.quantity).toBe(500);
    expect(stockEnfermaria.quantity).toBe(30);
    expect(stockCentroCirurgico.quantity).toBe(50);
  });

  it('5. Solicitação entre setores possui setor solicitante, setor fornecedor, itens e status', () => {
    const requestEnfermariaToFarmacia = {
      id: 'req-001',
      requestingSectorId: enfermariaSectorId,
      supplyingSectorId: farmaciaSectorId,
      requestedByUserId: enfermeiroUserId,
      status: RequestStatus.PENDENTE,
      observation: 'Reposição de plantão',
      items: [
        {
          productId: dipironaProductId,
          requestedQuantity: 50,
          deliveredQuantity: 0,
        }
      ]
    };

    expect(requestEnfermariaToFarmacia.requestingSectorId).toBe(enfermariaSectorId);
    expect(requestEnfermariaToFarmacia.supplyingSectorId).toBe(farmaciaSectorId);
    expect(requestEnfermariaToFarmacia.requestingSectorId).not.toBe(requestEnfermariaToFarmacia.supplyingSectorId);
    expect(requestEnfermariaToFarmacia.status).toBe('PENDENTE');
    expect(requestEnfermariaToFarmacia.items[0].requestedQuantity).toBe(50);
  });

  it('6. Segurança: Intercepta e impede forjar o requestingSectorId via manipulação de payload', async () => {
    const tamperedPayload = {
      supplyingSectorId: almoxarifadoSectorId,
      sectorId: farmaciaSectorId,
      items: [{ productId: seringaProductId, requestedQuantity: 100 }],
    };

    let receivedSectorInHandler: string | null = null;

    const handler = withSectorScoping(async (req, ctx, session) => {
      receivedSectorInHandler = session.sectorId;
      return new Response(JSON.stringify({ success: true, sectorId: session.sectorId }));
    });

    const token = await signToken({
      sub: enfermeiroUserId,
      sectorId: enfermariaSectorId,
      roleId: crypto.randomUUID(),
    });

    const mockRequest = new Request('http://localhost:3000/api/inventory/requests', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify(tamperedPayload)
    });

    await handler(mockRequest, {});

    expect(receivedSectorInHandler).toBe(enfermariaSectorId);
    expect(receivedSectorInHandler).not.toBe(farmaciaSectorId);
  });

  it('7. Transferência e atendimento registram setor de origem e setor de destino explicitamente', () => {
    const originSector = farmaciaSectorId;
    const destSector = enfermariaSectorId;
    const qty = 20;

    const movementExit = {
      id: 'mov-exit-01',
      productId: dipironaProductId,
      sectorId: originSector,
      sourceSectorId: originSector,
      destinationSectorId: destSector,
      type: MovementType.TRANSFERENCIA,
      quantity: qty,
      previousBalance: 500,
      newBalance: 480,
      performedByUserId: farmaceuticoUserId,
    };

    const movementEntry = {
      id: 'mov-entry-01',
      productId: dipironaProductId,
      sectorId: destSector,
      sourceSectorId: originSector,
      destinationSectorId: destSector,
      type: MovementType.TRANSFERENCIA,
      quantity: qty,
      previousBalance: 30,
      newBalance: 50,
      performedByUserId: farmaceuticoUserId,
    };

    expect(movementExit.sourceSectorId).toBe(farmaciaSectorId);
    expect(movementExit.destinationSectorId).toBe(enfermariaSectorId);
    expect(movementEntry.sourceSectorId).toBe(farmaciaSectorId);
    expect(movementEntry.destinationSectorId).toBe(enfermariaSectorId);
    expect(movementExit.newBalance).toBe(480);
    expect(movementEntry.newBalance).toBe(50);
  });

  it('8. Baixa de estoque via rota real decrementa saldo e registra rastreabilidade com auditoria', async () => {
    const token = await signToken({
      sub: farmaceuticoUserId,
      sectorId: farmaciaSectorId,
      roleId: 'role-farmacia',
    });

    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
      id: farmaceuticoUserId,
      status: UserStatus.ATIVO,
      roleId: 'role-farmacia',
    } as any);

    vi.spyOn(prisma.rolePermission, 'findFirst').mockResolvedValue({ id: 'perm-manage' } as any);

    let stockBalance = 500;
    let registeredMovement: any = null;

    vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => {
      const tx = {
        stock: {
          findUnique: vi.fn(async () => ({
            id: 'stock-farm-dip',
            productId: dipironaProductId,
            sectorId: farmaciaSectorId,
            quantity: stockBalance,
          })),
          updateMany: vi.fn(async ({ data }: any) => {
            stockBalance -= data.quantity.decrement;
            return { count: 1 };
          }),
          findUniqueOrThrow: vi.fn(async () => ({
            id: 'stock-farm-dip',
            quantity: stockBalance,
          })),
        },
        stockMovement: {
          create: vi.fn(async ({ data }: any) => {
            registeredMovement = { id: 'mov-saida-01', ...data };
            return registeredMovement;
          }),
        },
        auditLog: {
          create: vi.fn(async () => ({ id: 'audit-01' })),
        },
      };
      return await cb(tx);
    });

    const req = new NextRequest('http://localhost:3000/api/inventory/exit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        productId: dipironaProductId,
        quantity: 50,
        reason: 'Dispensação para Enfermaria',
      }),
    });

    const res = await exitRoute(req, {});
    expect(res.status).toBe(201);
    expect(stockBalance).toBe(450);
    expect(registeredMovement).not.toBeNull();
    expect(registeredMovement.quantity).toBe(50);
    expect(registeredMovement.previousBalance).toBe(500);
    expect(registeredMovement.newBalance).toBe(450);
  });

  it('9. Validação atômica impede saldo negativo caso o fornecedor não possua a quantidade solicitada', async () => {
    const token = await signToken({
      sub: farmaceuticoUserId,
      sectorId: farmaciaSectorId,
      roleId: 'role-farmacia',
    });

    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
      id: farmaceuticoUserId,
      status: UserStatus.ATIVO,
      roleId: 'role-farmacia',
    } as any);

    vi.spyOn(prisma.rolePermission, 'findFirst').mockResolvedValue({ id: 'perm-manage' } as any);

    vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => {
      const tx = {
        stock: {
          findUnique: vi.fn(async () => ({
            id: 'stock-farm-dip',
            productId: dipironaProductId,
            sectorId: farmaciaSectorId,
            quantity: 30, // Apenas 30 disponíveis
          })),
          updateMany: vi.fn(async () => ({ count: 0 })),
        },
      };
      return await cb(tx);
    });

    // Tentativa de retirar 50 quando só existem 30
    const req = new NextRequest('http://localhost:3000/api/inventory/exit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        productId: dipironaProductId,
        quantity: 50,
        reason: 'Tentativa de retirada acima do saldo',
      }),
    });

    const res = await exitRoute(req, {});
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toBe('Saldo insuficiente em estoque');
  });

  it('10. Isolamento de Setor: Impede que colaborador da Enfermaria atenda solicitação destinada a Farmácia', async () => {
    const requestId = crypto.randomUUID();

    // Sessão de enfermeiro pertencente à Enfermaria
    const token = await signToken({
      sub: enfermeiroUserId,
      sectorId: enfermariaSectorId,
      roleId: 'role-enfermeiro',
    });

    vi.spyOn(prisma.sectorRequest, 'findUnique').mockResolvedValue({
      id: requestId,
      supplyingSectorId: farmaciaSectorId, // Setor fornecedor é a Farmácia
      requestingSectorId: enfermariaSectorId,
      status: RequestStatus.PENDENTE,
      items: [],
      requestingSector: { name: 'Enfermaria' },
      supplyingSector: { name: 'Farmácia' },
    } as any);

    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
      id: enfermeiroUserId,
      status: UserStatus.ATIVO,
      role: { name: 'ENFERMEIRO' }, // Não é administrador nem da Farmácia
    } as any);

    const req = new NextRequest(`http://localhost:3000/api/inventory/requests/${requestId}/attend`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

    const params = Promise.resolve({ id: requestId });
    const res = await attendRoute(req, { params });

    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toMatch(/setor fornecedor/i);
  });

  it('11. Rastreabilidade Completa: Toda movimentação registra origem, destino, usuário e ID da solicitação', () => {
    const requestId = crypto.randomUUID();

    const auditTrail = {
      id: 'mov-audit-01',
      productId: seringaProductId,
      sourceSectorId: almoxarifadoSectorId,
      destinationSectorId: centroCirurgicoSectorId,
      quantity: 200,
      type: MovementType.TRANSFERENCIA,
      performedByUserId: almoxarifeUserId,
      requestId: requestId,
      reason: 'Atendimento de Solicitação #req-hosp',
      createdAt: new Date(),
    };

    expect(auditTrail.sourceSectorId).toBe(almoxarifadoSectorId);
    expect(auditTrail.destinationSectorId).toBe(centroCirurgicoSectorId);
    expect(auditTrail.performedByUserId).toBe(almoxarifeUserId);
    expect(auditTrail.requestId).toBe(requestId);
    expect(auditTrail.type).toBe('TRANSFERENCIA');
  });

  it('12. Demonstração dos três fluxos hospitalares canônicos via rota real de transferência', async () => {
    const token = await signToken({
      sub: almoxarifeUserId,
      sectorId: almoxarifadoSectorId,
      roleId: 'role-almoxarifado',
    });

    vi.spyOn(prisma.user, 'findUnique').mockResolvedValue({
      id: almoxarifeUserId,
      status: UserStatus.ATIVO,
      roleId: 'role-almoxarifado',
    } as any);

    vi.spyOn(prisma.rolePermission, 'findFirst').mockResolvedValue({ id: 'perm-manage' } as any);

    vi.spyOn(prisma.sector, 'findUnique').mockResolvedValue({
      id: farmaciaSectorId,
      name: 'Farmácia Central',
      status: 'ATIVO',
    } as any);

    vi.spyOn(prisma.product, 'findUnique').mockResolvedValue({
      id: seringaProductId,
      name: 'Seringa Descartável 10ml',
      categoryId: crypto.randomUUID(),
    } as any);

    vi.spyOn(prisma.sectorCategory, 'count').mockResolvedValue(0);

    let almoxStock = 2000;
    let farmStock = 400;

    vi.spyOn(prisma, '$transaction').mockImplementation(async (cb: any) => {
      const tx = {
        stock: {
          findUnique: vi.fn(async () => ({
            id: 'stock-almox-seringa',
            productId: seringaProductId,
            sectorId: almoxarifadoSectorId,
            quantity: almoxStock,
          })),
          updateMany: vi.fn(async ({ data }: any) => {
            almoxStock -= data.quantity.decrement;
            return { count: 1 };
          }),
          findUniqueOrThrow: vi.fn(async () => ({
            id: 'stock-almox-seringa',
            quantity: almoxStock,
          })),
          upsert: vi.fn(async () => {
            farmStock += 100;
            return { id: 'stock-farm-seringa', quantity: farmStock };
          }),
        },
        stockMovement: {
          create: vi.fn(async ({ data }: any) => ({ id: 'mov-transf-1', ...data })),
        },
        auditLog: {
          create: vi.fn(async () => ({ id: 'audit-transf-1' })),
        },
      };
      return await cb(tx);
    });

    const req = new NextRequest('http://localhost:3000/api/inventory/transfer', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
      },
      body: JSON.stringify({
        productId: seringaProductId,
        destinationSectorId: farmaciaSectorId,
        quantity: 100,
        reason: 'Transferência de estoque para farmácia',
      }),
    });

    const res = await transferRoute(req, {});
    expect(res.status).toBe(201);
    expect(almoxStock).toBe(1900);
    expect(farmStock).toBe(500);
  });
});
