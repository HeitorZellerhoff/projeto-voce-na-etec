'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Package, 
  AlertTriangle, 
  Clock, 
  ArrowRightLeft, 
  ShoppingCart, 
  Plus, 
  Minus, 
  SlidersHorizontal,
  Layers,
  CheckCircle2,
  Send
} from 'lucide-react';
import { MovementModal } from '@/components/inventory/MovementModal';
import { AdjustmentModal } from '@/components/inventory/AdjustmentModal';
import { CreateRequestModal } from '@/components/requests/CreateRequestModal';
import { RequestsListTable } from '@/components/requests/RequestsListTable';

interface ProductItem {
  id: string;
  code: string;
  name: string;
  unit: string;
  minimumStock: number;
  maximumStock: number;
}

interface BatchItem {
  id: string;
  batchNumber: string;
  expirationDate: string | Date;
  productId: string;
}

interface StockItem {
  id: string;
  productId: string;
  quantity: number;
  product: ProductItem;
  batch?: BatchItem | null;
}

interface MovementItem {
  id: string;
  type: string;
  quantity: number;
  reason: string;
  createdAt: string | Date;
  product: { name: string };
  batch?: { batchNumber: string } | null;
}

interface Props {
  stocks: StockItem[];
  recentMovements: MovementItem[];
  products: ProductItem[];
  batches: BatchItem[];
  outgoingRequests?: any[];
  incomingRequests?: any[];
  sectors?: any[];
  currentSector?: any;
}

export function FarmaciaDashboardClient({
  stocks,
  recentMovements,
  products,
  batches,
  outgoingRequests = [],
  incomingRequests = [],
  sectors = [],
  currentSector,
}: Props) {
  const router = useRouter();

  // Modals state
  const [movementModalState, setMovementModalState] = useState<{
    isOpen: boolean;
    type: 'ENTRADA' | 'SAIDA';
    productId?: string;
    productName?: string;
  }>({
    isOpen: false,
    type: 'ENTRADA',
  });

  const [adjustmentModalState, setAdjustmentModalState] = useState<{
    isOpen: boolean;
    productId: string;
    productName: string;
    previousBalance: number;
  }>({
    isOpen: false,
    productId: '',
    productName: '',
    previousBalance: 0,
  });

  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);

  // Métricas em tempo real
  const totalStockUnits = stocks.reduce((acc, s) => acc + s.quantity, 0);
  const criticalItems = stocks.filter(s => s.quantity <= s.product.minimumStock);

  const now = new Date();
  const thirtyDaysAhead = new Date();
  thirtyDaysAhead.setDate(thirtyDaysAhead.getDate() + 45);

  const expiringBatches = batches.filter(b => {
    const exp = new Date(b.expirationDate);
    return exp >= now && exp <= thirtyDaysAhead;
  });

  const handleSuccess = () => {
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Dashboard: Farmácia Central</h1>
          <p className="text-xs text-zinc-400 mt-0.5">Dispensação, controle de lotes e movimentações de fármacos</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsRequestModalOpen(true)}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-medium text-sm transition-all shadow-lg shadow-cyan-500/20 flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            Nova Solicitação
          </button>
          <button
            onClick={() =>
              setMovementModalState({
                isOpen: true,
                type: 'ENTRADA',
              })
            }
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium text-sm transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Nova Entrada
          </button>
          <button
            onClick={() =>
              setMovementModalState({
                isOpen: true,
                type: 'SAIDA',
              })
            }
            className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-medium text-sm transition-all shadow-lg shadow-amber-500/20 flex items-center gap-2"
          >
            <Minus className="w-4 h-4" />
            Registrar Saída
          </button>
        </div>
      </div>

      {/* Metric Cards Dinâmicos */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-6 bg-zinc-900/50 rounded-2xl border border-white/5 backdrop-blur-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-emerald-500/10 rounded-xl">
              <Package className="w-6 h-6 text-emerald-400" />
            </div>
            <h3 className="text-sm font-medium text-zinc-400">Total em Estoque</h3>
          </div>
          <p className="text-3xl font-bold text-white">
            {totalStockUnits.toLocaleString('pt-BR')}{' '}
            <span className="text-sm text-zinc-500 font-normal">unidades</span>
          </p>
        </div>

        <div className="p-6 bg-zinc-900/50 rounded-2xl border border-white/5 backdrop-blur-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-amber-500/10 rounded-xl">
              <AlertTriangle className="w-6 h-6 text-amber-400" />
            </div>
            <h3 className="text-sm font-medium text-zinc-400">Estoque Crítico</h3>
          </div>
          <p className="text-3xl font-bold text-white">
            {criticalItems.length}{' '}
            <span className="text-sm text-zinc-500 font-normal">produtos</span>
          </p>
          {criticalItems.length > 0 && (
            <p className="text-xs text-amber-400 mt-1">Saldo abaixo do mínimo</p>
          )}
        </div>

        <div className="p-6 bg-zinc-900/50 rounded-2xl border border-white/5 backdrop-blur-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full blur-2xl -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-red-500/10 rounded-xl">
              <Clock className="w-6 h-6 text-red-400" />
            </div>
            <h3 className="text-sm font-medium text-zinc-400">Vencimento (45d)</h3>
          </div>
          <p className="text-3xl font-bold text-white">
            {expiringBatches.length}{' '}
            <span className="text-sm text-zinc-500 font-normal">lotes</span>
          </p>
        </div>

        <div className="p-6 bg-zinc-900/50 rounded-2xl border border-white/5 backdrop-blur-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-2xl -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-cyan-500/10 rounded-xl">
              <ArrowRightLeft className="w-6 h-6 text-cyan-400" />
            </div>
            <h3 className="text-sm font-medium text-zinc-400">Movimentações</h3>
          </div>
          <p className="text-3xl font-bold text-white">
            {recentMovements.length}{' '}
            <span className="text-sm text-zinc-500 font-normal">recentes</span>
          </p>
        </div>
      </div>

      {/* Tabela de Produtos em Estoque com Ações Rápidas */}
      <div className="bg-zinc-900/50 rounded-2xl border border-white/5 backdrop-blur-sm overflow-hidden">
        <div className="p-5 border-b border-white/5 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white">Inventário da Farmácia Central</h2>
            <p className="text-xs text-zinc-400">Medicamentos e insumos armazenados na farmácia</p>
          </div>
          <span className="text-xs font-medium text-emerald-400 bg-emerald-500/10 px-2.5 py-1 rounded-full border border-emerald-500/20">
            {stocks.length} itens controlados
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-zinc-400">
            <thead className="bg-black/20 text-xs uppercase text-zinc-500 border-b border-white/5">
              <tr>
                <th className="px-6 py-3.5 font-medium">Medicamento / Insumo</th>
                <th className="px-6 py-3.5 font-medium">Lote</th>
                <th className="px-6 py-3.5 font-medium">Saldo Atual</th>
                <th className="px-6 py-3.5 font-medium">Mínimo / Máximo</th>
                <th className="px-6 py-3.5 font-medium">Status</th>
                <th className="px-6 py-3.5 text-right font-medium">Ações de Estoque</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {stocks.map((stock) => {
                const isCritical = stock.quantity <= stock.product.minimumStock;
                return (
                  <tr key={stock.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-white font-medium">{stock.product.name}</div>
                      <div className="text-xs text-zinc-500">Cód: {stock.product.code} • Un: {stock.product.unit}</div>
                    </td>
                    <td className="px-6 py-4">
                      {stock.batch ? (
                        <div>
                          <span className="font-mono text-xs text-zinc-300">{stock.batch.batchNumber}</span>
                          <div className="text-[11px] text-zinc-500">
                            Val: {new Date(stock.batch.expirationDate).toLocaleDateString('pt-BR')}
                          </div>
                        </div>
                      ) : (
                        <span className="text-xs text-zinc-600">Lote Geral</span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-base font-bold ${isCritical ? 'text-amber-400' : 'text-white'}`}>
                        {stock.quantity.toLocaleString('pt-BR')}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-xs text-zinc-400">
                      {stock.product.minimumStock} / {stock.product.maximumStock}
                    </td>
                    <td className="px-6 py-4">
                      {isCritical ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          <AlertTriangle className="w-3 h-3" /> Crítico
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle2 className="w-3 h-3" /> Adequado
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() =>
                            setMovementModalState({
                              isOpen: true,
                              type: 'ENTRADA',
                              productId: stock.product.id,
                              productName: stock.product.name,
                            })
                          }
                          className="px-2.5 py-1 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-400 text-xs font-medium rounded-lg border border-emerald-500/20 transition-colors"
                          title="Registrar Entrada"
                        >
                          + Entrada
                        </button>
                        <button
                          onClick={() =>
                            setMovementModalState({
                              isOpen: true,
                              type: 'SAIDA',
                              productId: stock.product.id,
                              productName: stock.product.name,
                            })
                          }
                          className="px-2.5 py-1 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-xs font-medium rounded-lg border border-amber-500/20 transition-colors"
                          title="Registrar Saída"
                        >
                          - Saída
                        </button>
                        <button
                          onClick={() =>
                            setAdjustmentModalState({
                              isOpen: true,
                              productId: stock.product.id,
                              productName: stock.product.name,
                              previousBalance: stock.quantity,
                            })
                          }
                          className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-zinc-300 text-xs font-medium rounded-lg border border-white/5 transition-colors"
                          title="Ajuste / Inventário Físico"
                        >
                          Ajustar
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Grid: Últimas Movimentações */}
      <div className="p-6 bg-zinc-900/50 rounded-2xl border border-white/5 backdrop-blur-sm">
        <h2 className="text-base font-bold text-white mb-4">Últimas Movimentações da Farmácia</h2>
        {recentMovements.length === 0 ? (
          <p className="text-xs text-zinc-500 py-6 text-center">Nenhuma movimentação registrada recentemente.</p>
        ) : (
          <div className="space-y-3">
            {recentMovements.map((m) => (
              <div
                key={m.id}
                className="flex items-center justify-between p-4 bg-black/20 rounded-xl border border-white/5"
              >
                <div className="flex items-center gap-4">
                  <div
                    className={`w-2.5 h-2.5 rounded-full ${
                      m.type === 'ENTRADA'
                        ? 'bg-emerald-500'
                        : m.type === 'SAIDA'
                        ? 'bg-amber-500'
                        : 'bg-purple-500'
                    }`}
                  ></div>
                  <div>
                    <p className="text-sm font-medium text-white">{m.product.name}</p>
                    <p className="text-xs text-zinc-500">
                      Motivo: {m.reason} {m.batch ? `• Lote: ${m.batch.batchNumber}` : ''} •{' '}
                      {new Date(m.createdAt).toLocaleDateString('pt-BR', {
                        day: '2-digit',
                        month: '2-digit',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p
                    className={`text-sm font-bold ${
                      m.type === 'ENTRADA'
                        ? 'text-emerald-400'
                        : m.type === 'SAIDA'
                        ? 'text-amber-400'
                        : 'text-purple-400'
                    }`}
                  >
                    {m.type === 'ENTRADA' ? `+${m.quantity}` : `-${m.quantity}`} un
                  </p>
                  <p className="text-xs text-zinc-500">{m.type}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Solicitações de Materiais */}
      {currentSector && (
        <div className="pt-2">
          <div className="mb-3">
            <h2 className="text-base font-bold text-white">Solicitações de Materiais da Farmácia</h2>
            <p className="text-xs text-zinc-400">
              Requisições enviadas ao Almoxarifado e pedidos recebidos de enfermarias e centros cirúrgicos
            </p>
          </div>
          <RequestsListTable
            currentSectorId={currentSector.id}
            outgoingRequests={outgoingRequests}
            incomingRequests={incomingRequests}
            onRefresh={handleSuccess}
          />
        </div>
      )}

      {/* Modais Integrados */}
      {currentSector && sectors.length > 0 && (
        <CreateRequestModal
          isOpen={isRequestModalOpen}
          onClose={() => setIsRequestModalOpen(false)}
          currentSectorName={currentSector.name}
          currentSectorId={currentSector.id}
          availableSectors={sectors}
          availableProducts={products as any}
          onSuccess={handleSuccess}
        />
      )}
      <MovementModal
        isOpen={movementModalState.isOpen}
        onClose={() => setMovementModalState({ ...movementModalState, isOpen: false })}
        type={movementModalState.type}
        productId={movementModalState.productId}
        productName={movementModalState.productName}
        products={products}
        batches={batches}
        onSuccess={handleSuccess}
      />

      {adjustmentModalState.isOpen && (
        <AdjustmentModal
          isOpen={adjustmentModalState.isOpen}
          onClose={() => setAdjustmentModalState({ ...adjustmentModalState, isOpen: false })}
          productId={adjustmentModalState.productId}
          productName={adjustmentModalState.productName}
          previousBalance={adjustmentModalState.previousBalance}
          onSuccess={handleSuccess}
        />
      )}
    </div>
  );
}
