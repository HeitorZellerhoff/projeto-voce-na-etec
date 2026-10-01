'use client';

import { useState } from 'react';
import { X, Loader2, CheckCircle2, ShieldAlert, AlertTriangle } from 'lucide-react';

interface PurchaseDetail {
  id: string;
  status: string;
  totalAmount: number | null;
  requestedByUserId: string;
  requestedBy: { name: string; email: string };
  supplier: { name: string; cnpj: string };
  items: Array<{
    id: string;
    quantity: number;
    unitPrice: number;
    product: { name: string; unit: string };
  }>;
}

interface ApprovePurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  purchase: PurchaseDetail | null;
  currentUserId: string;
  onSuccess: () => void;
}

export function ApprovePurchaseModal({
  isOpen,
  onClose,
  purchase,
  currentUserId,
  onSuccess,
}: ApprovePurchaseModalProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const [isRejecting, setIsRejecting] = useState(false);
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectInput, setShowRejectInput] = useState(false);

  if (!isOpen || !purchase) return null;

  const isSelfRequester = purchase.requestedByUserId === currentUserId;
  const isPending = purchase.status === 'PENDENTE_APROVACAO';

  const handleApprove = async () => {
    setIsLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/purchases/${purchase.id}/approve`, {
        method: 'POST',
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao aprovar a compra');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro inesperado ao aprovar compra');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim() && !confirm('Deseja realmente rejeitar esta compra sem justificativa detalhada?')) {
      return;
    }

    setIsRejecting(true);
    setError('');

    try {
      const res = await fetch(`/api/purchases/${purchase.id}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: rejectReason.trim() || 'Rejeitada pelo responsável' }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao rejeitar a compra');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro inesperado ao rejeitar compra');
    } finally {
      setIsRejecting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 to-emerald-500"></div>

        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl">
                <CheckCircle2 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight">Revisão de Compra Hospitalar</h2>
                <p className="text-xs text-zinc-400">Verificação de conformidade e autorização orçamentária</p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={isLoading || isRejecting}
              className="text-zinc-500 hover:text-white transition-colors disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {isSelfRequester && (
            <div className="mb-4 p-3.5 bg-amber-500/10 border border-amber-500/20 rounded-xl text-amber-300 text-xs flex items-start gap-2.5 leading-relaxed">
              <AlertTriangle className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
              <div>
                <strong>Segregação de Funções (SoD) Ativa:</strong> Você solicitou esta compra. As normas de controle interno e auditoria exigem que outro usuário homologado (supervisor ou administrador) aprove a ordem.
              </div>
            </div>
          )}

          <div className="space-y-3 bg-black/30 p-4 rounded-xl border border-white/5 text-xs text-zinc-300">
            <div className="flex justify-between">
              <span className="text-zinc-500">Fornecedor:</span>
              <span className="font-semibold text-white">{purchase.supplier.name}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">CNPJ:</span>
              <span className="font-mono text-zinc-400">{purchase.supplier.cnpj}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Solicitante:</span>
              <span className="text-zinc-200">{purchase.requestedBy.name} ({purchase.requestedBy.email})</span>
            </div>
            <div className="flex justify-between">
              <span className="text-zinc-500">Status Atual:</span>
              <span className="font-medium text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/20">
                {purchase.status}
              </span>
            </div>

            <div className="pt-2 border-t border-white/5">
              <span className="text-zinc-500 block mb-2 font-medium">Itens Inclusos:</span>
              <div className="space-y-1.5 max-h-32 overflow-y-auto">
                {purchase.items.map((i) => (
                  <div key={i.id} className="flex justify-between text-[11px] bg-black/40 p-2 rounded-lg">
                    <span className="text-white">{i.product.name} ({i.quantity} {i.product.unit})</span>
                    <span className="font-mono text-zinc-400">
                      {(i.quantity * i.unitPrice).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="pt-2 border-t border-white/5 flex justify-between text-sm font-bold text-white">
              <span>Valor Total:</span>
              <span className="text-emerald-400 font-mono">
                {(purchase.totalAmount ?? 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>
          </div>

          {showRejectInput && isPending && (
            <div className="mt-4 p-3.5 bg-red-500/10 border border-red-500/20 rounded-xl space-y-2">
              <label className="text-xs font-semibold text-red-300 block">
                Motivo da Rejeição / Cancelamento:
              </label>
              <textarea
                value={rejectReason}
                onChange={(e) => setRejectReason(e.target.value)}
                placeholder="Informe a justificativa da recusa da compra..."
                rows={2}
                className="w-full bg-black/50 border border-white/10 rounded-lg p-2 text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-red-500"
              />
            </div>
          )}

          <div className="pt-4 flex justify-between gap-2 border-t border-white/5 mt-4">
            <div>
              {isPending && !showRejectInput && (
                <button
                  type="button"
                  onClick={() => setShowRejectInput(true)}
                  disabled={isLoading || isRejecting}
                  className="px-3.5 py-2 text-xs font-medium text-red-400 hover:text-red-300 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 rounded-xl transition-colors disabled:opacity-50"
                >
                  Rejeitar Compra
                </button>
              )}
              {showRejectInput && (
                <button
                  type="button"
                  onClick={handleReject}
                  disabled={isLoading || isRejecting}
                  className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-500 rounded-xl transition-all shadow-lg shadow-red-500/20 disabled:opacity-40 flex items-center gap-2"
                >
                  {isRejecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                  Confirmar Rejeição
                </button>
              )}
            </div>

            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading || isRejecting}
                className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-colors disabled:opacity-50"
              >
                Fechar
              </button>
              {isPending && (
                <button
                  type="button"
                  onClick={handleApprove}
                  disabled={isLoading || isRejecting || isSelfRequester}
                  className="px-5 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                  Aprovar Compra
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
