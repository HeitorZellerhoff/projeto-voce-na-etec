'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  ShoppingCart, 
  CheckCircle, 
  Clock, 
  Plus, 
  Eye, 
  FileText 
} from 'lucide-react';
import { CreatePurchaseModal } from './CreatePurchaseModal';
import { ApprovePurchaseModal } from './ApprovePurchaseModal';
import { Supplier, Product } from '@/generated/prisma';

interface PurchaseItem {
  id: string;
  status: string;
  totalAmount: number | null;
  createdAt: string | Date;
  requestedByUserId: string;
  requestedBy: { name: string; email: string };
  approvedBy?: { name: string; email: string } | null;
  supplier: { name: string; cnpj: string };
  items: Array<{
    id: string;
    quantity: number;
    unitPrice: number;
    product: { name: string; unit: string };
  }>;
}

interface Props {
  purchases: PurchaseItem[];
  suppliers: Supplier[];
  products: Product[];
  currentUserId: string;
}

export function ComprasDashboardClient({
  purchases,
  suppliers,
  products,
  currentUserId,
}: Props) {
  const router = useRouter();

  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [selectedPurchase, setSelectedPurchase] = useState<PurchaseItem | null>(null);

  const pendingCount = purchases.filter(p => p.status === 'PENDENTE_APROVACAO').length;
  const approvedCount = purchases.filter(p => p.status === 'APROVADO').length;
  const totalAmountSum = purchases.reduce((sum, p) => sum + (p.totalAmount ?? 0), 0);

  const handleSuccess = () => {
    router.refresh();
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white tracking-tight">Dashboard: Departamento de Compras</h1>
          <p className="text-xs text-zinc-400 mt-0.5">Gestão de aquisições hospitalares, cotações e governança com segregação de funções</p>
        </div>
        <button
          onClick={() => setIsCreateModalOpen(true)}
          className="px-4 py-2 bg-amber-600 hover:bg-amber-500 text-white rounded-xl font-medium text-sm transition-all shadow-lg shadow-amber-500/20 flex items-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Nova Solicitação de Compra
        </button>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-6 bg-zinc-900/50 rounded-2xl border border-white/5 backdrop-blur-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-amber-500/10 rounded-xl">
              <Clock className="w-6 h-6 text-amber-400" />
            </div>
            <h3 className="text-sm font-medium text-zinc-400">Aguardando Aprovação (SoD)</h3>
          </div>
          <p className="text-3xl font-bold text-white">
            {pendingCount}{' '}
            <span className="text-sm text-zinc-500 font-normal">ordens</span>
          </p>
        </div>

        <div className="p-6 bg-zinc-900/50 rounded-2xl border border-white/5 backdrop-blur-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-emerald-500/10 rounded-xl">
              <CheckCircle className="w-6 h-6 text-emerald-400" />
            </div>
            <h3 className="text-sm font-medium text-zinc-400">Compras Homologadas</h3>
          </div>
          <p className="text-3xl font-bold text-white">
            {approvedCount}{' '}
            <span className="text-sm text-zinc-500 font-normal">aprovadas</span>
          </p>
        </div>

        <div className="p-6 bg-zinc-900/50 rounded-2xl border border-white/5 backdrop-blur-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-2xl -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-cyan-500/10 rounded-xl">
              <ShoppingCart className="w-6 h-6 text-cyan-400" />
            </div>
            <h3 className="text-sm font-medium text-zinc-400">Volume Transacionado</h3>
          </div>
          <p className="text-2xl font-bold text-white font-mono">
            {totalAmountSum.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
        </div>
      </div>

      {/* Tabela de Compras */}
      <div className="bg-zinc-900/50 rounded-2xl border border-white/5 backdrop-blur-sm overflow-hidden">
        <div className="p-5 border-b border-white/5 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold text-white">Ordens de Compra e Cotações</h2>
            <p className="text-xs text-zinc-400">Acompanhamento de pedidos, orçamentos e segregação de aprovação</p>
          </div>
          <span className="text-xs font-medium text-zinc-400 bg-white/5 px-2.5 py-1 rounded-full border border-white/10">
            {purchases.length} ordens registradas
          </span>
        </div>

        <div className="overflow-x-auto">
          {purchases.length === 0 ? (
            <div className="p-12 text-center text-zinc-500 text-sm">
              Nenhuma solicitação de compra cadastrada ainda. Clique em &quot;Nova Solicitação de Compra&quot; para iniciar.
            </div>
          ) : (
            <table className="w-full text-left text-sm text-zinc-400">
              <thead className="bg-black/20 text-xs uppercase text-zinc-500 border-b border-white/5">
                <tr>
                  <th className="px-6 py-3.5 font-medium">Ordem / Fornecedor</th>
                  <th className="px-6 py-3.5 font-medium">Solicitante</th>
                  <th className="px-6 py-3.5 font-medium">Itens</th>
                  <th className="px-6 py-3.5 font-medium">Valor Total</th>
                  <th className="px-6 py-3.5 font-medium">Status</th>
                  <th className="px-6 py-3.5 text-right font-medium">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/5">
                {purchases.map((purchase) => (
                  <tr key={purchase.id} className="hover:bg-white/5 transition-colors">
                    <td className="px-6 py-4">
                      <div className="text-white font-medium">{purchase.supplier.name}</div>
                      <div className="text-xs text-zinc-500">ID: {purchase.id.slice(0, 8)}... • CNPJ: {purchase.supplier.cnpj}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-zinc-200 text-xs font-medium">{purchase.requestedBy.name}</div>
                      <div className="text-[11px] text-zinc-500">{new Date(purchase.createdAt).toLocaleDateString('pt-BR')}</div>
                    </td>
                    <td className="px-6 py-4 text-xs text-zinc-300">
                      {purchase.items.length} {purchase.items.length === 1 ? 'item' : 'itens'}
                    </td>
                    <td className="px-6 py-4 font-mono font-bold text-white text-xs">
                      {(purchase.totalAmount ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </td>
                    <td className="px-6 py-4">
                      {purchase.status === 'PENDENTE_APROVACAO' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          <Clock className="w-3 h-3" /> Pendente
                        </span>
                      ) : purchase.status === 'APROVADO' ? (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <CheckCircle className="w-3 h-3" /> Aprovado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-white/5 text-zinc-400 border border-white/10">
                          {purchase.status}
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right">
                      <button
                        onClick={() => setSelectedPurchase(purchase)}
                        className="px-3 py-1.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 text-xs font-semibold rounded-lg border border-amber-500/20 transition-colors inline-flex items-center gap-1.5"
                      >
                        <Eye className="w-3.5 h-3.5" /> Revisar / SoD
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Modais */}
      <CreatePurchaseModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        suppliers={suppliers}
        products={products}
        onSuccess={handleSuccess}
      />

      <ApprovePurchaseModal
        isOpen={!!selectedPurchase}
        onClose={() => setSelectedPurchase(null)}
        purchase={selectedPurchase}
        currentUserId={currentUserId}
        onSuccess={handleSuccess}
      />
    </div>
  );
}
