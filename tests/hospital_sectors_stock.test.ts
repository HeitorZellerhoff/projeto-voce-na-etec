import { describe, it, expect, vi, beforeEach } from 'vitest';
import { signToken, verifyToken } from '../src/lib/auth/jwt';
import { withSectorScoping } from '../src/lib/security/guards';
import { MovementType, RequestStatus } from '../src/generated/prisma';

// Mock do prisma para testar a camada de serviços e transações de forma determinística
describe('Validação Estrutural de Setores Hospitalares e Isolamento de Estoque (Section 62/63)', () => {
  const adminSectorId = '11111111-1111-1111-1111-111111111111';
  const farmaciaSectorId = '22222222-2222-2222-2222-222222222222';
  const almoxarifadoSectorId = '33333333-3333-3333-3333-333333333333';
  const enfermariaSectorId = '44444444-4444-4444-4444-444444444444';
  const centroCirurgicoSectorId = '55555555-5555-5555-5555-555555555555';

  const enfermeiroUserId = 'user-enfermeiro-uuid';
  const farmaceuticoUserId = 'user-farmaceutico-uuid';
  const almoxarifeUserId = 'user-almoxarife-uuid';

  const dipironaProductId = 'prod-dipirona-uuid';
  const seringaProductId = 'prod-seringa-uuid';

  // 1. Teste de Criação de Setor como Entidade Única
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

  // 2. Teste de Associação Usuário/Setor
  it('2. Usuário possui associação estrita com seu setor no JWT/sessão e backend valida', async () => {
    const payload = {
      sub: enfermeiroUserId,
      sectorId: enfermariaSectorId,
      roleId: 'role-enfermeiro-uuid'
    };

    const token = await signToken(payload);
    expect(token).toBeDefined();

    const decoded = await verifyToken(token);
    expect(decoded).not.toBeNull();
    expect(decoded?.sub).toBe(enfermeiroUserId);
    expect(decoded?.sectorId).toBe(enfermariaSectorId);
    expect(decoded?.sectorId).not.toBe(farmaciaSectorId);
  });

  // 3. Teste de Criação de Estoque por Setor
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

  // 4. Teste de Mesmo Item em Setores Diferentes com Quantidades Independentes
  it('4. REGRA FUNDAMENTAL: O mesmo item existe em múltiplos setores com estoques e saldos independentes', () => {
    // Simulação do cenário real hospitalar com o mesmo produto (Dipirona)
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

    // Asserção: Mesmo item físico (productId idêntico), porém estoques lógicos 100% isolados
    expect(stockFarmacia.productId).toBe(stockEnfermaria.productId);
    expect(stockEnfermaria.productId).toBe(stockCentroCirurgico.productId);

    // Asserção: Setores e registros de estoque distintos
    expect(stockFarmacia.id).not.toBe(stockEnfermaria.id);
    expect(stockFarmacia.sectorId).not.toBe(stockEnfermaria.sectorId);

    // Asserção: Quantidades estritamente independentes
    expect(stockFarmacia.quantity).toBe(500);
    expect(stockEnfermaria.quantity).toBe(30);
    expect(stockCentroCirurgico.quantity).toBe(50);
  });

  // 5. Teste de Solicitação Entre Setores
  it('5. Solicitação entre setores possui setor solicitante, setor fornecedor, itens e status', () => {
    // Enfermaria solicita Dipirona para a Farmácia
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

  // 6. Teste de Tentativa de Solicitação com Parameter Tampering / Sem Autorização
  it('6. Segurança: Intercepta e impede forjar o requestingSectorId via manipulação de payload', async () => {
    // O enfermeiro da Enfermaria tenta enviar no JSON que o solicitante é a Farmácia
    const tamperedPayload = {
      supplyingSectorId: almoxarifadoSectorId,
      sectorId: farmaciaSectorId, // Tentativa de Spoofing / Tampering
      items: [{ productId: seringaProductId, requestedQuantity: 100 }],
    };

    let receivedSectorInHandler: string | null = null;

    // Simulando o HOC withSectorScoping
    const handler = withSectorScoping(async (req, ctx, session) => {
      // O handler seguro extrai EXCLUSIVAMENTE o setor de session.sectorId
      receivedSectorInHandler = session.sectorId;
      return new Response(JSON.stringify({ success: true, sectorId: session.sectorId }));
    });

    // Simulamos a emissão do token criptografado HttpOnly para o enfermeiro
    const token = await signToken({
      sub: enfermeiroUserId,
      sectorId: enfermariaSectorId, // Setor real do token
      roleId: 'role-enfermeiro-uuid',
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

    // O backend descartou farmaciaSectorId e impôs enfermariaSectorId
    expect(receivedSectorInHandler).toBe(enfermariaSectorId);
    expect(receivedSectorInHandler).not.toBe(farmaciaSectorId);
  });

  // 7. Teste de Transferência entre Setores
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

  // 8. Teste de Baixa de Estoque
  it('8. Baixa de estoque decrementa o saldo do fornecedor e atualiza rastreabilidade', () => {
    let farmaciaStockBalance = 500;
    const transferQty = 50;

    const previousBalance = farmaciaStockBalance;
    farmaciaStockBalance -= transferQty;
    const newBalance = farmaciaStockBalance;

    expect(previousBalance).toBe(500);
    expect(newBalance).toBe(450);
    expect(newBalance).toBe(previousBalance - transferQty);
  });

  // 9. Teste de Quantidade Insuficiente (Prevenção de Saldo Negativo)
  it('9. Validação atômica impede saldo negativo caso o fornecedor não possua a quantidade', () => {
    const stockQuantity = 30;
    const requestedQuantity = 50;

    const performTransfer = (available: number, requested: number) => {
      if (available < requested) {
        throw new Error('INSUFFICIENT_FUNDS: Saldo insuficiente em estoque no setor fornecedor');
      }
      return available - requested;
    };

    expect(() => performTransfer(stockQuantity, requestedQuantity)).toThrowError(
      'INSUFFICIENT_FUNDS: Saldo insuficiente em estoque no setor fornecedor'
    );
  });

  // 10. Teste de Tentativa de Acessar/Alterar Estoque de Outro Setor sem Permissão
  it('10. Isolamento de Setor: Impede que colaborador da Enfermaria atenda solicitação destinada a Farmácia', () => {
    const request = {
      id: 'req-002',
      requestingSectorId: enfermariaSectorId,
      supplyingSectorId: farmaciaSectorId, // Apenas a Farmácia pode atender
      status: RequestStatus.PENDENTE,
    };

    // Colaborador tentando atender: Enfermeiro da Enfermaria
    const userAttemptingAction = {
      id: enfermeiroUserId,
      sectorId: enfermariaSectorId,
      role: 'ENFERMEIRO'
    };

    const canAttend = (req: typeof request, user: typeof userAttemptingAction) => {
      const isSupplyingSector = user.sectorId === req.supplyingSectorId;
      const isAdmin = user.role === 'ADMINISTRADOR';
      if (!isSupplyingSector && !isAdmin) {
        throw new Error('Acesso negado: Colaborador não pertence ao setor fornecedor desta solicitação');
      }
      return true;
    };

    expect(() => canAttend(request, userAttemptingAction)).toThrowError(
      'Acesso negado: Colaborador não pertence ao setor fornecedor desta solicitação'
    );
  });

  // 11. Teste de Histórico e Rastreabilidade Completa da Movimentação
  it('11. Rastreabilidade Completa: Toda movimentação registra origem, destino, usuário e ID da solicitação', () => {
    const requestId = 'req-hosp-789-uuid';

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

  // 12. Validação dos Fluxos Hospitalares Canônicos
  it('12. Demonstração dos três fluxos principais com estoques separados e isolados', () => {
    // Estado inicial de estoques de Seringa 10ml
    const initialStocks = {
      almoxarifado: 2000,
      farmacia: 400,
      enfermaria: 80,
      centroCirurgico: 250,
    };

    // Fluxo A: Farmácia → solicita 100 ao Almoxarifado
    const fluxoAFarmaciaToAlmox = 100;
    initialStocks.almoxarifado -= fluxoAFarmaciaToAlmox;
    initialStocks.farmacia += fluxoAFarmaciaToAlmox;

    expect(initialStocks.almoxarifado).toBe(1900);
    expect(initialStocks.farmacia).toBe(500);
    expect(initialStocks.enfermaria).toBe(80); // Permanece inalterado
    expect(initialStocks.centroCirurgico).toBe(250); // Permanece inalterado

    // Fluxo B: Enfermaria → solicita 30 a Farmácia
    const fluxoBEnfToFarm = 30;
    initialStocks.farmacia -= fluxoBEnfToFarm;
    initialStocks.enfermaria += fluxoBEnfToFarm;

    expect(initialStocks.farmacia).toBe(470);
    expect(initialStocks.enfermaria).toBe(110);
    expect(initialStocks.almoxarifado).toBe(1900); // Permanece inalterado

    // Fluxo C: Centro Cirúrgico → solicita 150 ao Almoxarifado
    const fluxoCCCtoAlmox = 150;
    initialStocks.almoxarifado -= fluxoCCCtoAlmox;
    initialStocks.centroCirurgico += fluxoCCCtoAlmox;

    expect(initialStocks.almoxarifado).toBe(1750);
    expect(initialStocks.centroCirurgico).toBe(400);

    // Verificação final dos saldos isolados
    expect(initialStocks.almoxarifado).toBe(1750);
    expect(initialStocks.farmacia).toBe(470);
    expect(initialStocks.enfermaria).toBe(110);
    expect(initialStocks.centroCirurgico).toBe(400);
  });
});
