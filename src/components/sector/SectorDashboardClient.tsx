'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Building2, 
  Package, 
  Send, 
  Database, 
  Layers, 
  AlertTriangle, 
  Printer, 
  ArrowRightLeft,
  Clock,
  ShieldCheck
} from 'lucide-react';
import { CreateRequestModal } from '@/components/requests/CreateRequestModal';
import { RequestsListTable, SectorRequestData } from '@/components/requests/RequestsListTable';
import { Sector, Product, ProductBatch } from '@/generated/prisma';

interface SectorStockItem {
  id: string;
  productId: string;
  quantity: number;
  minimumQuantity?: number | null;
  maximumQuantity?: number | null;
  product: Product & { category?: { name: string } | null };
  batch?: ProductBatch | null;
}

interface SectorDashboardClientProps {
  currentSector: Sector;
  stocks: SectorStockItem[];
  availableSectors: Sector[];
  availableProducts: Product[];
  outgoingRequests: SectorRequestData[];
  incomingRequests: SectorRequestData[];
}

export function SectorDashboardClient({
  currentSector,
  stocks,
  availableSectors,
  availableProducts,
  outgoingRequests,
  incomingRequests,
}: SectorDashboardClientProps) {
  const router = useRouter();
  const [isRequestModalOpen, setIsRequestModalOpen] = useState(false);

  const totalUnits = stocks.reduce((acc, s) => acc + s.quantity, 0);
  const pendingOutgoing = outgoingRequests.filter(r => r.status === 'PENDENTE').length;
  const pendingIncoming = incomingRequests.filter(r => r.status === 'PENDENTE').length;
  
  // Itens em atenção comparados ao mínimo setorial ou produto
  const criticalItems = stocks.filter(s => {
    const min = s.minimumQuantity ?? s.product.minimumStock;
    return s.quantity <= min;
  });

  const handleRefresh = () => {
    router.refresh();
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="space-y-6">
      {/* BANNER DO CONTEXTO DE SETOR ATUAL (Exigência Explícita de Isolamento Visual) */}
      <div className="p-4 bg-gradient-to-r from-emerald-950/60 via-zinc-900 to-zinc-900 border border-emerald-500/30 rounded-2xl shadow-xl flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3.5">
          <div className="p-3 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
            <Building2 className="w-6 h-6" />
          </div>
          <div>
            <div className="text-[11px] font-bold uppercase tracking-wider text-emerald-400">
              SETOR ATUAL
            </div>
            <h1 className="text-xl md:text-2xl font-extrabold text-white tracking-tight flex items-center gap-2">
              🏥 {currentSector.name}
            </h1>
            <p className="text-xs text-zinc-400 mt-0.5">
              Código: <span className="font-mono text-zinc-300 font-semibold">{currentSector.code}</span> • {currentSector.description || 'Ambiente Operacional Hospitalar'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={handlePrint}
            className="px-3.5 py-2 bg-white/5 hover:bg-white/10 text-zinc-300 hover:text-white rounded-xl text-xs font-semibold border border-white/10 transition-all flex items-center gap-2"
          >
            <Printer className="w-4 h-4" />
            Imprimir Relatório
          </button>
          <button
            onClick={() => setIsRequestModalOpen(true)}
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl text-xs font-bold transition-all shadow-lg shadow-emerald-500/20 flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            Nova Solicitação de Material
          </button>
        </div>
      </div>

      {/* CARDS DE MÉTRICAS DO SETOR */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-zinc-900/50 rounded-2xl border border-white/5 backdrop-blur-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-zinc-400">Saldo no Setor</span>
            <div className="p-2 bg-emerald-500/10 text-emerald-400 rounded-lg">
              <Database className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white">
            {totalUnits.toLocaleString('pt-BR')}{' '}
            <span className="text-xs font-normal text-zinc-500">unidades</span>
          </p>
        </div>

        <div className="p-5 bg-zinc-900/50 rounded-2xl border border-white/5 backdrop-blur-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-zinc-400">Linhas de Itens no Setor</span>
            <div className="p-2 bg-cyan-500/10 text-cyan-400 rounded-lg">
              <Layers className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white">
            {stocks.length}{' '}
            <span className="text-xs font-normal text-zinc-500">produtos</span>
          </p>
        </div>

        <div className="p-5 bg-zinc-900/50 rounded-2xl border border-white/5 backdrop-blur-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-zinc-400">Solicitações Pendentes</span>
            <div className="p-2 bg-amber-500/10 text-amber-400 rounded-lg">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white">
            {pendingOutgoing}{' '}
            <span className="text-xs font-normal text-zinc-500">enviadas</span>
            {pendingIncoming > 0 && (
              <span className="text-xs text-amber-400 ml-2 font-medium">({pendingIncoming} a atender)</span>
            )}
          </p>
        </div>

        <div className="p-5 bg-zinc-900/50 rounded-2xl border border-white/5 backdrop-blur-sm relative overflow-hidden">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-medium text-zinc-400">Estoque em Atenção</span>
            <div className="p-2 bg-purple-500/10 text-purple-400 rounded-lg">
              <AlertTriangle className="w-5 h-5" />
            </div>
          </div>
          <p className="text-2xl font-bold text-white">
            {criticalItems.length}{' '}
            <span className="text-xs font-normal text-zinc-500">abaixo do mínimo</span>
          </p>
        </div>
      </div>

      {/* TABELA: ESTOQUE DO SETOR */}
      <div className="bg-zinc-900/50 rounded-2xl border border-white/5 backdrop-blur-sm overflow-hidden">
        <div className="p-5 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-bold text-white uppercase tracking-tight">
              ESTOQUE DA {currentSector.name.toUpperCase()}
            </h2>
            <p className="text-xs text-zinc-400">
              Registros e quantidades sob custódia e responsabilidade exclusiva deste setor
            </p>
          </div>
          <span className="text-xs text-emerald-400 font-mono bg-emerald-500/10 px-2.5 py-1 rounded-md border border-emerald-500/20">
            Estoque Lógico Isolado
          </span>
        </div>

        {stocks.length === 0 ? (
          <div className="p-12 text-center text-zinc-500 text-sm">
            Nenhum material cadastrado no estoque deste setor. Utilize &quot;Nova Solicitação&quot; para requisitar itens de Farmácia ou Almoxarifado.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm text-zinc-400">
              <thead className="bg-black/20 text-xs uppercase text-zinc-500 border-b border-white/5">
                <tr>
                  <th className="px-6 py-3.5 font-medium">Material / Insumo</th>
                  <th className="px-6 py-3.5 font-medium">Categoria</th>
                  <th className="px-6 py-3.5 font-medium">Lote Ativo</th>
                  <th className="px-6 py-3.5 font-medium">Saldo no Setor</th>
                  <th className="px-6 py-3.5 font-medium">Faixa de Segurança</th>
                  <th className="px-6 py-3.5 text-right font-medium">Status Setorial</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {stocks.map((stock) => {
                  const min = stock.minimumQuantity ?? stock.product.minimumStock;
                  const isLow = stock.quantity <= min;
                  return (
                    <tr key={stock.id} className="hover:bg-white/5 transition-colors">
                      <td className="px-6 py-4">
                        <div className="text-white font-medium">{stock.product.name}</div>
                        <div className="text-xs text-zinc-500">
                          Cód: {stock.product.code} • Unidade: {stock.product.unit}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs text-zinc-300">
                        {stock.product.category?.name || 'Insumo Geral'}
                      </td>
                      <td className="px-6 py-4 font-mono text-xs">
                        {stock.batch ? (
                          <span className="text-zinc-300">{stock.batch.batchNumber}</span>
                        ) : (
                          <span className="text-zinc-600">Lote Único</span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`text-base font-bold ${isLow ? 'text-amber-400' : 'text-white'}`}>
                          {stock.quantity.toLocaleString('pt-BR')}
                        </span>
                        <span className="text-xs text-zinc-500 ml-1">{stock.product.unit}</span>
                      </td>
                      <td className="px-6 py-4 text-xs text-zinc-400">
                        Mínimo Setor: <span className="text-zinc-200 font-semibold">{min}</span>
                        {stock.maximumQuantity && (
                          <span className="text-zinc-500 ml-1">/ Máx: {stock.maximumQuantity}</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right">
                        {isLow ? (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                            Reposição Recomendada
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                            Adequado
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* SEÇÃO: SOLICITAÇÕES ENTRE SETORES */}
      <div>
        <div className="mb-3">
          <h2 className="text-base font-bold text-white">Solicitações de Materiais do Setor</h2>
          <p className="text-xs text-zinc-400">
            Acompanhe pedidos enviados e requisições recebidas para atendimento com rastreabilidade
          </p>
        </div>

        <RequestsListTable
          currentSectorId={currentSector.id}
          outgoingRequests={outgoingRequests}
          incomingRequests={incomingRequests}
          onRefresh={handleRefresh}
        />
      </div>

      {/* Modal de Nova Solicitação */}
      <CreateRequestModal
        isOpen={isRequestModalOpen}
        onClose={() => setIsRequestModalOpen(false)}
        currentSectorName={currentSector.name}
        currentSectorId={currentSector.id}
        availableSectors={availableSectors}
        availableProducts={availableProducts}
        onSuccess={handleRefresh}
      />
    </div>
  );
}
