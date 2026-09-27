'use client';

import { useState } from 'react';
import { X, Loader2, Send, AlertTriangle, Building2, Package } from 'lucide-react';
import { Sector, Product } from '@/generated/prisma';

interface CreateRequestModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentSectorName: string;
  currentSectorId: string;
  availableSectors: Sector[];
  availableProducts: Product[];
  onSuccess: () => void;
}

export function CreateRequestModal({
  isOpen,
  onClose,
  currentSectorName,
  currentSectorId,
  availableSectors,
  availableProducts,
  onSuccess,
}: CreateRequestModalProps) {
  // Setores fornecedores disponíveis (exclui o setor do próprio usuário)
  const supplyingSectors = availableSectors.filter(s => s.id !== currentSectorId && s.status === 'ATIVO');
  
  const [supplyingSectorId, setSupplyingSectorId] = useState(supplyingSectors[0]?.id || '');
  const [productId, setProductId] = useState(availableProducts[0]?.id || '');
  const [quantity, setQuantity] = useState('');
  const [observation, setObservation] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const q = parseInt(quantity, 10);
      if (isNaN(q) || q <= 0) {
        throw new Error('A quantidade solicitada deve ser um número inteiro positivo.');
      }
      if (!supplyingSectorId) {
        throw new Error('Selecione o setor fornecedor.');
      }
      if (!productId) {
        throw new Error('Selecione o item desejado.');
      }

      const res = await fetch('/api/inventory/requests', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplyingSectorId,
          items: [
            {
              productId,
              requestedQuantity: q,
            }
          ],
          observation: observation || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao emitir solicitação de material');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro inesperado ao solicitar material');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-cyan-500"></div>

        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-emerald-500/10 text-emerald-400 rounded-xl">
                <Send className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight">Nova Solicitação de Material</h2>
                <p className="text-xs text-zinc-400">Requisição formal com rastreabilidade entre setores hospitalares</p>
              </div>
            </div>
            <button
              onClick={onClose}
              disabled={isLoading}
              className="text-zinc-500 hover:text-white transition-colors disabled:opacity-50"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Setor Solicitante (Travado com o Setor do Usuário) */}
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Setor Solicitante (Origem do Pedido)</label>
              <div className="flex items-center gap-2.5 px-3.5 py-2.5 bg-black/40 border border-emerald-500/30 rounded-xl text-emerald-300 text-sm font-semibold">
                <Building2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{currentSectorName}</span>
                <span className="ml-auto text-xs font-normal text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded">Meu Setor</span>
              </div>
            </div>

            {/* Setor Fornecedor */}
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Setor Fornecedor (Destino do Pedido)</label>
              <select
                value={supplyingSectorId}
                onChange={(e) => setSupplyingSectorId(e.target.value)}
                required
                className="w-full px-3 py-2.5 bg-black/50 border border-white/10 rounded-xl text-white text-sm outline-none focus:border-emerald-500 transition-colors"
              >
                {supplyingSectors.map((s) => (
                  <option key={s.id} value={s.id} className="bg-zinc-900">
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Item / Insumo */}
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Item / Insumo Solicitado</label>
              <select
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                required
                className="w-full px-3 py-2.5 bg-black/50 border border-white/10 rounded-xl text-white text-sm outline-none focus:border-emerald-500 transition-colors"
              >
                {availableProducts.map((p) => (
                  <option key={p.id} value={p.id} className="bg-zinc-900">
                    {p.name} ({p.unit}) — Cód: {p.code}
                  </option>
                ))}
              </select>
            </div>

            {/* Quantidade */}
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Quantidade Necessária</label>
              <input
                type="number"
                min="1"
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="Ex: 50"
                className="w-full px-3 py-2.5 bg-black/50 border border-white/10 rounded-xl text-white text-sm outline-none focus:border-emerald-500 transition-colors"
              />
            </div>

            {/* Observação / Justificativa Clínica */}
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Observação / Justificativa Setorial (Opcional)</label>
              <textarea
                value={observation}
                onChange={(e) => setObservation(e.target.value)}
                placeholder="Ex: Reposição para procedimentos de urgência no plantão noturno"
                className="w-full px-3 py-2 bg-black/50 border border-white/10 rounded-xl text-white text-sm outline-none focus:border-emerald-500 transition-colors min-h-[70px] resize-none"
              />
            </div>

            <div className="pt-3 flex justify-end gap-3 border-t border-white/5">
              <button
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-colors disabled:opacity-50"
              >
                Cancelar
              </button>
              <button
                type="submit"
                disabled={isLoading}
                className="px-5 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 flex items-center gap-2"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Enviar Solicitação
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
