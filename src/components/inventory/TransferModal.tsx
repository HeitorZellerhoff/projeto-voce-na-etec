'use client';

import { useState } from 'react';
import { X, Loader2, ArrowRightLeft, ShieldAlert } from 'lucide-react';
import { Sector, Product, ProductBatch } from '@/generated/prisma';

interface TransferModalProps {
  isOpen: boolean;
  onClose: () => void;
  products: Product[];
  batches?: ProductBatch[];
  sectors: Sector[]; // Setores de destino disponíveis
  currentSectorId: string;
  defaultProductId?: string;
  onSuccess: () => void;
}

export function TransferModal({
  isOpen,
  onClose,
  products,
  batches = [],
  sectors,
  currentSectorId,
  defaultProductId,
  onSuccess,
}: TransferModalProps) {
  const [productId, setProductId] = useState(defaultProductId || products[0]?.id || '');
  const [batchId, setBatchId] = useState('');
  
  // Setores de destino (exclui o setor atual)
  const availableDestinations = sectors.filter(s => s.id !== currentSectorId);
  const [destinationSectorId, setDestinationSectorId] = useState(availableDestinations[0]?.id || '');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('Reabastecimento rotineiro');
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
        throw new Error('A quantidade deve ser um número positivo.');
      }
      if (!destinationSectorId) {
        throw new Error('Selecione o setor de destino.');
      }

      const res = await fetch('/api/inventory/transfer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          batchId: batchId || undefined,
          destinationSectorId,
          quantity: q,
          reason,
          observation: observation || undefined,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao processar transferência');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro inesperado ao transferir insumos');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 to-emerald-500"></div>

        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-cyan-500/10 text-cyan-400 rounded-xl">
                <ArrowRightLeft className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight">Transferência Entre Setores</h2>
                <p className="text-xs text-zinc-400">Movimentação física de materiais com rastreabilidade</p>
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
              <ShieldAlert className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Item a Transferir</label>
              <select
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
                className="w-full px-3 py-2.5 bg-black/50 border border-white/10 rounded-xl text-white text-sm outline-none focus:border-cyan-500 transition-colors"
              >
                {products.map((p) => (
                  <option key={p.id} value={p.id} className="bg-zinc-900">
                    {p.name} ({p.unit})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Setor de Destino</label>
                <select
                  value={destinationSectorId}
                  onChange={(e) => setDestinationSectorId(e.target.value)}
                  className="w-full px-3 py-2.5 bg-black/50 border border-white/10 rounded-xl text-white text-sm outline-none focus:border-cyan-500 transition-colors"
                >
                  {availableDestinations.map((s) => (
                    <option key={s.id} value={s.id} className="bg-zinc-900">
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Lote (Opcional)</label>
                {batches.length > 0 ? (
                  <select
                    value={batchId}
                    onChange={(e) => setBatchId(e.target.value)}
                    className="w-full px-3 py-2.5 bg-black/50 border border-white/10 rounded-xl text-white text-sm outline-none focus:border-cyan-500 transition-colors"
                  >
                    <option value="" className="bg-zinc-900">Lote Geral</option>
                    {batches
                      .filter((b) => !productId || b.productId === productId)
                      .map((b) => (
                        <option key={b.id} value={b.id} className="bg-zinc-900">
                          {b.batchNumber}
                        </option>
                      ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={batchId}
                    onChange={(e) => setBatchId(e.target.value)}
                    placeholder="ID do Lote"
                    className="w-full px-3 py-2.5 bg-black/50 border border-white/10 rounded-xl text-white text-sm outline-none focus:border-cyan-500 transition-colors"
                  />
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Quantidade</label>
                <input
                  type="number"
                  min="1"
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  placeholder="0"
                  className="w-full px-3 py-2.5 bg-black/50 border border-white/10 rounded-xl text-white text-sm outline-none focus:border-cyan-500 transition-colors"
                />
              </div>

              <div>
                <label className="block text-xs font-medium text-zinc-300 mb-1">Motivo / Requisição</label>
                <input
                  type="text"
                  required
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  placeholder="Ex: Pedido #903"
                  className="w-full px-3 py-2.5 bg-black/50 border border-white/10 rounded-xl text-white text-sm outline-none focus:border-cyan-500 transition-colors"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-300 mb-1">Observações Internas (Opcional)</label>
              <textarea
                value={observation}
                onChange={(e) => setObservation(e.target.value)}
                placeholder="Ex: Carga expedida via carrinho hospitalar às 14h"
                className="w-full px-3 py-2 bg-black/50 border border-white/10 rounded-xl text-white text-sm outline-none focus:border-cyan-500 transition-colors min-h-[70px] resize-none"
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
                className="px-5 py-2 text-sm font-semibold text-white bg-cyan-600 hover:bg-cyan-500 rounded-xl transition-all shadow-lg shadow-cyan-500/20 disabled:opacity-50 flex items-center gap-2"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Efetuar Transferência
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
