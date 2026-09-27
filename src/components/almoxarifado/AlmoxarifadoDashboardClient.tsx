'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Database, 
  Truck, 
  ArrowRightLeft, 
  Layers, 
  Plus, 
  Printer, 
  CheckCircle2, 
  AlertTriangle,
  Send
} from 'lucide-react';
import { TransferModal } from '@/components/inventory/TransferModal';
import { MovementModal } from '@/components/inventory/MovementModal';
import { CreateRequestModal } from '@/components/requests/CreateRequestModal';
import { RequestsListTable } from '@/components/requests/RequestsListTable';
import { Product, ProductBatch, Sector } from '@/generated/prisma';

interface StockItem {
  id: string;
  productId: string;
  quantity: number;
  product: Product;
  batch?: ProductBatch | null;
}

interface MovementItem {
  id: string;
  type: string;
  quantity: number;
  reason: string;
  createdAt: string | Date;
  product: { name: string };
  batch?: { batchNumber: string } | null;
  sector?: { name: string } | null;
}

interface Props {
  stocks: StockItem[];
  recentMovements: MovementItem[];
  products: Product[];
  batches: ProductBatch[];
  sectors: Sector[];
  almoxSectorId: string;
  outgoingRequests?: any[];
  incomingRequests?: any[];
  currentSector?: Sector;
}

export function AlmoxarifadoDashboardClient({
  stocks,
  recentMovements,
  products,
  batches,
  sectors,
  almoxSectorId,
  outgoingRequests = [],
  incomingRequests = [],
  currentSector,
}: Props) {
  const router = useRouter();

  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string | undefined>(undefined);
  const [isEntryModalOpen, setIsEntryModalOpen] = useState(false);
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);

  const totalStored = stocks.reduce((acc, s) => acc + s.quantity, 0);
  const transferCount = recentMovements.filter(m => m.type === 'TRANSFERENCIA').length;
  const criticalItems = stocks.filter(s => s.quantity <= s.product.minimumStock);

  const handleSuccess = () => {
    router.refresh();
  };

  const handlePrintReport = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Dashboard: Almoxarifado Geral</h1>
          <p className="text-xs text-zinc-400 mt-0.5">Gestão de armazém central, recebimento de fornecedores e distribuição setorial</p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handlePrintReport}
            className="px-4 py-2 bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white rounded-xl font-medium text-sm transition-all border border-white/10 flex items-center gap-2"
          >
            <Printer className="w-4 h-4" />
            Imprimir Relatório
          </button>
          <button
            onClick={() => setIsRequestModalOpen(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium text-sm transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            Nova Solicitação
          </button>
          <button
            onClick={() => setIsEntryModalOpen(true)}
            className="px-4 py-2 bg-emerald-700 hover:bg-emerald-600 text-white rounded-xl font-medium text-sm transition-all shadow-lg shadow-emerald-700/20 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Receber Carga
          </button>
          <button
            onClick={() => {
              setSelectedProductId(undefined);
              setIsTransferModalOpen(true);
            }}
            className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-medium text-sm transition-all shadow-lg shadow-cyan-500/20 flex items-center gap-2"
          >
            <ArrowRightLeft className="w-4 h-4" />
            Nova Transferência
          </button>
        </div>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-6 bg-zinc-900/50 rounded-2xl border border-white/5 backdrop-blur-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-emerald-500/10 rounded-xl">
              <Database className="w-6 h-6 text-emerald-400" />
            </div>
            <h3 className="text-sm font-medium text-zinc-400">Total Armazenado</h3>
          </div>
          <p className="text-3xl font-bold text-white">
            {totalStored.toLocaleString('pt-BR')}{' '}
            <span className="text-sm text-zinc-500 font-normal">unidades</span>
          </p>
        </div>

        <div className="p-6 bg-zinc-900/50 rounded-2xl border border-white/5 backdrop-blur-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-2xl -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-cyan-500/10 rounded-xl">
              <Layers className="w-6 h-6 text-cyan-400" />
            </div>
            <h3 className="text-sm font-medium text-zinc-400">Linhas de Itens</h3>
          </div>
          <p className="text-3xl font-bold text-white">
            {stocks.length} <span className="text-sm text-zinc-500 font-normal">produtos</span>
          </p>
        </div>

        <div className="p-6 bg-zinc-900/50 rounded-2xl border border-white/5 backdrop-blur-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-amber-500/10 rounded-xl">
              <Truck className="w-6 h-6 text-amber-400" />
            </div>
            <h3 className="text-sm font-medium text-zinc-400">Transferências</h3>
          </div>
          <p className="text-3xl font-bold text-white">
            {transferCount} <span className="text-sm text-zinc-500 font-normal">expedidas</span>
          </p>
        </div>

        <div className="p-6 bg-zinc-900/50 rounded-2xl border border-white/5 backdrop-blur-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-2xl -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-purple-500/10 rounded-xl">
              <AlertTriangle className="w-6 h-6 text-purple-400" />
            </div>
            <h3 className="text-sm font-medium text-zinc-400">Estoque Atenção</h3>
          </div>
          <p className="text-3xl font-bold text-white">
            {criticalItems.length} <span className="text-sm text-zinc-500 font-normal">itens</span>
          </p>
        </div>
      </div>

      {/* Tabela de Estoque do Almoxarifado */}
      <div className="bg-zinc-900/50 rounded-2xl border border-white/5 backdrop-blur-sm overflow-hidden">
        <div className="p-5 border-b border-white/5 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white">Estoque Central do Almoxarifado</h2>
            <p className="text-xs text-zinc-400">Materiais disponíveis para expedição aos setores operacionais</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-zinc-400">
            <thead className="bg-black/20 text-xs uppercase text-zinc-500 border-b border-white/5">
              <tr>
                <th className="px-6 py-3.5 font-medium">Insumo / Material</th>
                <th className="px-6 py-3.5 font-medium">Lote Ativo</th>
                <th className="px-6 py-3.5 font-medium">Saldo em Armazém</th>
                <th className="px-6 py-3.5 font-medium">Faixa de Segurança</th>
                <th className="px-6 py-3.5 text-right font-medium">Operação</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {stocks.map((stock) => (
                <tr key={stock.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4">
                    <div className="text-white font-medium">{stock.product.name}</div>
                    <div className="text-xs text-zinc-500">Cód: {stock.product.code} • Un: {stock.product.unit}</div>
                  </td>
                  <td className="px-6 py-4">
                    {stock.batch ? (
                      <span className="font-mono text-xs text-zinc-300">{stock.batch.batchNumber}</span>
                    ) : (
                      <span className="text-xs text-zinc-600">Lote Único</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="text-base font-bold text-white">
                      {stock.quantity.toLocaleString('pt-BR')} {stock.product.unit}s
                    </span>
                  </td>
                  <td className="px-6 py-4 text-xs text-zinc-400">
                    Mín: {stock.product.minimumStock} | Máx: {stock.product.maximumStock}
                  </td>
                  <td className="px-6 py-4 text-right">
                    <button
                      onClick={() => {
                        setSelectedProductId(stock.product.id);
                        setIsTransferModalOpen(true);
                      }}
                      className="px-3 py-1.5 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 text-xs font-semibold rounded-lg border border-cyan-500/20 transition-colors inline-flex items-center gap-1.5"
                    >
                      <ArrowRightLeft className="w-3.5 h-3.5" /> Transferir
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Histórico Recente */}
      <div className="p-6 bg-zinc-900/50 rounded-2xl border border-white/5 backdrop-blur-sm">
        <h2 className="text-base font-bold text-white mb-4">Últimas Movimentações e Expedições</h2>
        {recentMovements.length === 0 ? (
          <p className="text-xs text-zinc-500 py-6 text-center">Nenhuma movimentação no almoxarifado recentemente.</p>
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
                      m.type === 'TRANSFERENCIA'
                        ? 'bg-cyan-500'
                        : m.type === 'ENTRADA'
                        ? 'bg-emerald-500'
                        : 'bg-amber-500'
                    }`}
                  ></div>
                  <div>
                    <p className="text-sm font-medium text-white">{m.product.name}</p>
                    <p className="text-xs text-zinc-500">
                      Tipo: {m.type} • Motivo: {m.reason} •{' '}
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
                        : m.type === 'TRANSFERENCIA'
                        ? 'text-cyan-400'
                        : 'text-amber-400'
                    }`}
                  >
                    {m.type === 'ENTRADA' ? `+${m.quantity}` : `-${m.quantity}`} un
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Solicitações de Materiais do Almoxarifado */}
      <div className="pt-2">
        <div className="mb-3">
          <h2 className="text-base font-bold text-white">Solicitações de Materiais do Almoxarifado</h2>
          <p className="text-xs text-zinc-400">
            Atendimento de requisições de outros setores (Enfermaria, Farmácia, Centro Cirúrgico) e pedidos emitidos
          </p>
        </div>
        <RequestsListTable
          currentSectorId={almoxSectorId}
          outgoingRequests={outgoingRequests}
          incomingRequests={incomingRequests}
          onRefresh={handleSuccess}
        />
      </div>

      {/* Modais */}
      {currentSector && (
        <CreateRequestModal
          isOpen={isRequestModalOpen}
          onClose={() => setIsRequestModalOpen(false)}
          currentSectorName={currentSector.name}
          currentSectorId={almoxSectorId}
          availableSectors={sectors}
          availableProducts={products}
          onSuccess={handleSuccess}
        />
      )}
      <TransferModal
        isOpen={isTransferModalOpen}
        onClose={() => setIsTransferModalOpen(false)}
        products={products}
        batches={batches}
        sectors={sectors}
        currentSectorId={almoxSectorId}
        defaultProductId={selectedProductId}
        onSuccess={handleSuccess}
      />

      <MovementModal
        isOpen={isEntryModalOpen}
        onClose={() => setIsEntryModalOpen(false)}
        type="ENTRADA"
        products={products}
        batches={batches}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
