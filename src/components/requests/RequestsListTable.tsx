'use client';

import { useState } from 'react';
import { 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  ArrowRight, 
  User, 
  Check, 
  X, 
  Loader2,
  Calendar,
  Building2,
  Package
} from 'lucide-react';
import { RequestStatus } from '@/generated/prisma';

export interface SectorRequestItemData {
  id: string;
  productId: string;
  requestedQuantity: number;
  approvedQuantity?: number | null;
  deliveredQuantity?: number | null;
  product: {
    name: string;
    code: string;
    unit: string;
  };
}

export interface SectorRequestData {
  id: string;
  requestingSectorId: string;
  supplyingSectorId: string;
  status: RequestStatus;
  observation?: string | null;
  createdAt: string | Date;
  requestingSector: { name: string; code: string };
  supplyingSector: { name: string; code: string };
  requestedBy: { name: string; email: string };
  attendedBy?: { name: string } | null;
  items: SectorRequestItemData[];
}

interface RequestsListTableProps {
  currentSectorId: string;
  outgoingRequests: SectorRequestData[];
  incomingRequests: SectorRequestData[];
  onRefresh: () => void;
}

export function RequestsListTable({
  currentSectorId,
  outgoingRequests,
  incomingRequests,
  onRefresh,
}: RequestsListTableProps) {
  const [activeTab, setActiveTab] = useState<'outgoing' | 'incoming'>('outgoing');
  const [loadingRequestId, setLoadingRequestId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [rejectModalState, setRejectModalState] = useState<{ isOpen: boolean; requestId: string | null }>({
    isOpen: false,
    requestId: null,
  });
  const [rejectReason, setRejectReason] = useState('');

  const currentList = activeTab === 'outgoing' ? outgoingRequests : incomingRequests;

  const handleAttendRequest = async (requestId: string) => {
    setLoadingRequestId(requestId);
    setActionError(null);
    try {
      const res = await fetch(`/api/inventory/requests/${requestId}/attend`, {
        method: 'POST',
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao atender solicitação');
      }
      onRefresh();
    } catch (err: any) {
      setActionError(err.message || 'Erro inesperado ao atender solicitação');
    } finally {
      setLoadingRequestId(null);
    }
  };

  const handleConfirmReject = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectModalState.requestId) return;
    setLoadingRequestId(rejectModalState.requestId);
    setActionError(null);

    try {
      const res = await fetch(`/api/inventory/requests/${rejectModalState.requestId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || 'Erro ao rejeitar solicitação');
      }
      setRejectModalState({ isOpen: false, requestId: null });
      setRejectReason('');
      onRefresh();
    } catch (err: any) {
      setActionError(err.message || 'Erro ao rejeitar');
    } finally {
      setLoadingRequestId(null);
    }
  };

  const getStatusBadge = (status: RequestStatus) => {
    switch (status) {
      case 'PENDENTE':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-amber-500/10 text-amber-400 border border-amber-500/20">
            <Clock className="w-3 h-3 animate-pulse" />
            Pendente
          </span>
        );
      case 'ATENDIDA':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
            <CheckCircle2 className="w-3 h-3" />
            Atendida
          </span>
        );
      case 'REJEITADA':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-red-500/10 text-red-400 border border-red-500/20">
            <XCircle className="w-3 h-3" />
            Rejeitada
          </span>
        );
      case 'CANCELADA':
        return (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-zinc-500/10 text-zinc-400 border border-zinc-500/20">
            <AlertCircle className="w-3 h-3" />
            Cancelada
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-zinc-800 text-zinc-300">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="bg-zinc-900/50 rounded-2xl border border-white/5 backdrop-blur-sm overflow-hidden">
      {/* Abas Superiores */}
      <div className="p-4 border-b border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2 bg-black/40 p-1 rounded-xl border border-white/5">
          <button
            onClick={() => setActiveTab('outgoing')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'outgoing'
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 shadow'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            Minhas Solicitações ({outgoingRequests.length})
          </button>
          <button
            onClick={() => setActiveTab('incoming')}
            className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
              activeTab === 'incoming'
                ? 'bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 shadow'
                : 'text-zinc-400 hover:text-white hover:bg-white/5'
            }`}
          >
            Solicitações Recebidas ({incomingRequests.length})
          </button>
        </div>

        <p className="text-xs text-zinc-400">
          {activeTab === 'outgoing'
            ? 'Materiais requisitados pelo seu setor a outros setores'
            : 'Requisições enviadas por outros setores para você atender'}
        </p>
      </div>

      {actionError && (
        <div className="m-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs flex items-center justify-between">
          <span>{actionError}</span>
          <button onClick={() => setActionError(null)} className="text-zinc-400 hover:text-white">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Lista / Tabela */}
      {currentList.length === 0 ? (
        <div className="p-12 text-center text-zinc-500 text-sm">
          Nenhuma solicitação encontrada nesta categoria.
        </div>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-zinc-400">
            <thead className="bg-black/20 text-xs uppercase text-zinc-500 border-b border-white/5">
              <tr>
                <th className="px-6 py-3.5 font-medium">Fluxo (De → Para)</th>
                <th className="px-6 py-3.5 font-medium">Itens Solicitados</th>
                <th className="px-6 py-3.5 font-medium">Solicitante</th>
                <th className="px-6 py-3.5 font-medium">Status</th>
                <th className="px-6 py-3.5 font-medium">Data</th>
                {activeTab === 'incoming' && (
                  <th className="px-6 py-3.5 text-right font-medium">Ações</th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {currentList.map((req) => (
                <tr key={req.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2 text-white font-medium text-xs sm:text-sm">
                      <span className="text-emerald-400">{req.requestingSector.name}</span>
                      <ArrowRight className="w-3.5 h-3.5 text-zinc-600 shrink-0" />
                      <span className="text-cyan-400">{req.supplyingSector.name}</span>
                    </div>
                    {req.observation && (
                      <div className="text-xs text-zinc-500 mt-1 italic">
                        &quot;{req.observation}&quot;
                      </div>
                    )}
                  </td>

                  <td className="px-6 py-4">
                    <div className="space-y-1">
                      {req.items.map((item) => (
                        <div key={item.id} className="text-xs">
                          <span className="text-white font-medium">{item.product.name}</span>
                          <span className="text-zinc-500 ml-1.5">
                            ({item.requestedQuantity} {item.product.unit})
                          </span>
                        </div>
                      ))}
                    </div>
                  </td>

                  <td className="px-6 py-4 text-xs">
                    <div className="text-zinc-300 font-medium">{req.requestedBy.name}</div>
                    <div className="text-zinc-500">{req.requestedBy.email}</div>
                  </td>

                  <td className="px-6 py-4">
                    {getStatusBadge(req.status)}
                  </td>

                  <td className="px-6 py-4 text-xs text-zinc-400">
                    {new Date(req.createdAt).toLocaleDateString('pt-BR', {
                      day: '2-digit',
                      month: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                  </td>

                  {activeTab === 'incoming' && (
                    <td className="px-6 py-4 text-right">
                      {req.status === 'PENDENTE' && (
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleAttendRequest(req.id)}
                            disabled={loadingRequestId === req.id}
                            className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg text-xs font-semibold transition-all shadow shadow-emerald-500/20 disabled:opacity-50 flex items-center gap-1.5"
                          >
                            {loadingRequestId === req.id ? (
                              <Loader2 className="w-3 h-3 animate-spin" />
                            ) : (
                              <Check className="w-3 h-3" />
                            )}
                            Atender
                          </button>
                          <button
                            onClick={() => setRejectModalState({ isOpen: true, requestId: req.id })}
                            disabled={loadingRequestId === req.id}
                            className="px-3 py-1.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 rounded-lg text-xs font-semibold transition-all disabled:opacity-50 flex items-center gap-1.5"
                          >
                            <X className="w-3 h-3" />
                            Rejeitar
                          </button>
                        </div>
                      )}
                      {req.status === 'ATENDIDA' && (
                        <span className="text-xs text-emerald-400 font-medium">Entregue ✓</span>
                      )}
                      {req.status === 'REJEITADA' && (
                        <span className="text-xs text-red-400">Rejeitada ✕</span>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Modal de Rejeição */}
      {rejectModalState.isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
          <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-md shadow-2xl p-6">
            <h3 className="text-base font-bold text-white mb-2">Rejeitar Solicitação de Material</h3>
            <p className="text-xs text-zinc-400 mb-4">Informe o motivo da não disponibilização para registro no histórico:</p>
            <form onSubmit={handleConfirmReject} className="space-y-4">
              <textarea
                required
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Ex: Item indisponível para entrega imediata ou lote reservado para emergências"
                className="w-full px-3 py-2 bg-black/50 border border-white/10 rounded-xl text-white text-sm outline-none focus:border-red-500 transition-colors min-h-[80px]"
              />
              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setRejectModalState({ isOpen: false, requestId: null })}
                  className="px-3 py-1.5 text-xs text-zinc-400 hover:text-white"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loadingRequestId !== null}
                  className="px-4 py-1.5 text-xs font-semibold bg-red-600 hover:bg-red-500 text-white rounded-lg transition-colors flex items-center gap-1.5"
                >
                  {loadingRequestId ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
                  Confirmar Rejeição
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
