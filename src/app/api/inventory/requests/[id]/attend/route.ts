import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { withAuth } from '@/lib/security/guards';
import { MovementType, RequestStatus } from '@/generated/prisma';

export const POST = withAuth(async (request, context, session) => {
  try {
    const params = await context.params;
    const { id } = params;

    if (!id) {
      return NextResponse.json({ error: 'ID da solicitação é obrigatório' }, { status: 400 });
    }

    const sectorRequest = await prisma.sectorRequest.findUnique({
      where: { id },
      include: {
        items: {
          include: { product: true }
        },
        requestingSector: true,
        supplyingSector: true,
      }
    });

    if (!sectorRequest) {
      return NextResponse.json({ error: 'Solicitação não encontrada' }, { status: 404 });
    }

    // Regra de Autorização: O usuário que atende a solicitação DEVE pertencer ao setor fornecedor
    // (ou ser ADMINISTRADOR)
    const user = await prisma.user.findUnique({
      where: { id: session.sub },
      include: { role: true }
    });

    const isSupplyingSectorUser = session.sectorId === sectorRequest.supplyingSectorId;
    const isAdmin = user?.role?.name === 'ADMINISTRADOR';

    if (!isSupplyingSectorUser && !isAdmin) {
      return NextResponse.json(
        { error: 'Apenas colaboradores do setor fornecedor ou administradores podem atender esta solicitação' },
        { status: 403 }
      );
    }

    // Validação de Estado
    if (sectorRequest.status !== RequestStatus.PENDENTE && sectorRequest.status !== RequestStatus.APROVADA) {
      return NextResponse.json(
        { error: `Esta solicitação não pode ser atendida pois está no status ${sectorRequest.status}` },
        { status: 400 }
      );
    }

    // TRANSAÇÃO ATÔMICA ACID COM ISOLAMENTO DE ESTOQUE
    const updatedResult = await prisma.$transaction(async (tx) => {
      // 1. Validar e movimentar cada item da solicitação
      for (const item of sectorRequest.items) {
        const requiredQty = item.requestedQuantity;

        // Buscar saldo no setor fornecedor
        const supplyingStock = await tx.stock.findUnique({
          where: {
            productId_sectorId_batchId: {
              productId: item.productId,
              sectorId: sectorRequest.supplyingSectorId,
              batchId: item.batchId || (null as any),
            }
          }
        });

        if (!supplyingStock || supplyingStock.quantity < requiredQty) {
          throw new Error(`INSUFFICIENT_STOCK:${item.product.name}`);
        }

        // 1.1 Decrementar estoque no setor fornecedor
        const updatedSupplyingStock = await tx.stock.update({
          where: { id: supplyingStock.id },
          data: { quantity: { decrement: requiredQty } }
        });

        // 1.2 Incrementar estoque no setor solicitante
        const updatedRequestingStock = await tx.stock.upsert({
          where: {
            productId_sectorId_batchId: {
              productId: item.productId,
              sectorId: sectorRequest.requestingSectorId,
              batchId: item.batchId || (null as any),
            }
          },
          update: { quantity: { increment: requiredQty } },
          create: {
            productId: item.productId,
            sectorId: sectorRequest.requestingSectorId,
            batchId: item.batchId || null,
            quantity: requiredQty,
          }
        });

        // 1.3 Movimentação de Saída no Fornecedor (com origem e destino explícitos)
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            sectorId: sectorRequest.supplyingSectorId,
            sourceSectorId: sectorRequest.supplyingSectorId,
            destinationSectorId: sectorRequest.requestingSectorId,
            batchId: item.batchId || null,
            type: MovementType.TRANSFERENCIA,
            quantity: requiredQty,
            previousBalance: supplyingStock.quantity,
            newBalance: updatedSupplyingStock.quantity,
            reason: `Atendimento de Solicitação #${sectorRequest.id.substring(0, 8)}`,
            observation: `Transferência expedida para o setor ${sectorRequest.requestingSector.name}`,
            performedByUserId: session.sub,
            requestId: sectorRequest.id,
          }
        });

        // 1.4 Movimentação de Entrada no Solicitante (com origem e destino explícitos)
        await tx.stockMovement.create({
          data: {
            productId: item.productId,
            sectorId: sectorRequest.requestingSectorId,
            sourceSectorId: sectorRequest.supplyingSectorId,
            destinationSectorId: sectorRequest.requestingSectorId,
            batchId: item.batchId || null,
            type: MovementType.TRANSFERENCIA,
            quantity: requiredQty,
            previousBalance: updatedRequestingStock.quantity - requiredQty,
            newBalance: updatedRequestingStock.quantity,
            reason: `Recebimento de Solicitação #${sectorRequest.id.substring(0, 8)}`,
            observation: `Transferência recebida do setor ${sectorRequest.supplyingSector.name}`,
            performedByUserId: session.sub,
            requestId: sectorRequest.id,
          }
        });

        // 1.5 Atualizar item da solicitação
        await tx.sectorRequestItem.update({
          where: { id: item.id },
          data: {
            approvedQuantity: requiredQty,
            deliveredQuantity: requiredQty,
          }
        });
      }

      // 2. Atualizar status da solicitação
      const updatedReq = await tx.sectorRequest.update({
        where: { id: sectorRequest.id },
        data: {
          status: RequestStatus.ATENDIDA,
          attendedByUserId: session.sub,
        },
        include: {
          items: { include: { product: true } },
          requestingSector: true,
          supplyingSector: true,
        }
      });

      // 3. Log de Auditoria
      await tx.auditLog.create({
        data: {
          userId: session.sub,
          sectorId: session.sectorId,
          action: 'SECTOR_REQUEST_ATTEND',
          entity: 'SectorRequest',
          entityId: sectorRequest.id,
          metadata: {
            requestingSectorId: sectorRequest.requestingSectorId,
            supplyingSectorId: sectorRequest.supplyingSectorId,
            itemsCount: sectorRequest.items.length,
          }
        }
      });

      return updatedReq;
    });

    return NextResponse.json({
      success: true,
      message: 'Solicitação atendida com sucesso e estoques atualizados',
      request: updatedResult
    });

  } catch (error: any) {
    if (error.message?.startsWith('INSUFFICIENT_STOCK:')) {
      const productName = error.message.replace('INSUFFICIENT_STOCK:', '');
      return NextResponse.json({
        error: `Saldo insuficiente em estoque no setor fornecedor para o item: ${productName}`
      }, { status: 400 });
    }
    console.error('Error attending sector request:', error);
    return NextResponse.json({ error: 'Erro interno ao processar o atendimento da solicitação' }, { status: 500 });
  }
});
