'use client';

import { useState } from 'react';
import { X, Loader2, ArrowRightLeft } from 'lucide-react';
import { z } from 'zod';

interface MovementModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: 'ENTRADA' | 'SAIDA';
  productId: string;
  productName: string;
  onSuccess: () => void;
}

const movementSchema = z.object({
  quantity: z.number().int().positive('A quantidade deve ser maior que zero'),
  batchId: z.string().optional(),
  reason: z.string().min(3, 'O motivo deve ter pelo menos 3 caracteres'),
  observation: z.string().optional(),
});

export function MovementModal({ isOpen, onClose, type, productId, productName, onSuccess }: MovementModalProps) {
  const [quantity, setQuantity] = useState('');
  const [batchId, setBatchId] = useState('');
  const [reason, setReason] = useState('');
  const [observation, setObservation] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const parsed = movementSchema.parse({
        quantity: parseInt(quantity, 10),
        batchId: batchId || undefined,
        reason,
        observation
      });

      const endpoint = type === 'ENTRADA' ? '/api/inventory/entry' : '/api/inventory/exit';
      
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...parsed, productId })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || data.error || 'Erro ao processar movimentação');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      if (err instanceof z.ZodError) {
        setError((err as any).errors[0].message);
      } else {
        setError(err.message);
      }
    } finally {
      setIsLoading(false);
    }
  };

  const isEntry = type === 'ENTRADA';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden relative">
        {/* Top border accent */}
        <div className={`absolute top-0 left-0 w-full h-1 bg-gradient-to-r ${isEntry ? 'from-emerald-500 to-cyan-500' : 'from-amber-500 to-red-500'}`}></div>
        
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-lg ${isEntry ? 'bg-emerald-500/10 text-emerald-400' : 'bg-amber-500/10 text-amber-400'}`}>
                <ArrowRightLeft className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Registrar {isEntry ? 'Entrada' : 'Saída'}</h2>
                <p className="text-xs text-zinc-400">{productName}</p>
              </div>
            </div>
            <button onClick={onClose} disabled={isLoading} className="text-zinc-500 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-300">Quantidade</label>
                <input 
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => setQuantity(e.target.value)}
                  className="w-full px-3 py-2 bg-black/50 border border-white/5 rounded-lg text-white outline-none focus:border-emerald-500 transition-colors"
                  placeholder="0"
                  required
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-zinc-300">Lote Controlado (Opcional)</label>
                <input 
                  type="text"
                  value={batchId}
                  onChange={(e) => setBatchId(e.target.value)}
                  className="w-full px-3 py-2 bg-black/50 border border-white/5 rounded-lg text-white outline-none focus:border-emerald-500 transition-colors placeholder:text-zinc-600"
                  placeholder="ID do Lote"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300">Motivo</label>
              <input 
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2 bg-black/50 border border-white/5 rounded-lg text-white outline-none focus:border-emerald-500 transition-colors placeholder:text-zinc-600"
                placeholder={isEntry ? 'Ex: Compra emergencial, Doação' : 'Ex: Atendimento ambulatorial'}
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300">Observações (Opcional)</label>
              <textarea 
                value={observation}
                onChange={(e) => setObservation(e.target.value)}
                className="w-full px-3 py-2 bg-black/50 border border-white/5 rounded-lg text-white outline-none focus:border-emerald-500 transition-colors min-h-[80px] resize-none placeholder:text-zinc-600"
                placeholder="Detalhes adicionais da operação"
              />
            </div>

            <div className="pt-4 flex justify-end gap-3 border-t border-white/5">
              <button 
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="px-4 py-2 text-sm font-medium text-zinc-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
              >
                Cancelar
              </button>
              <button 
                type="submit"
                disabled={isLoading}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-all flex items-center gap-2 ${
                  isEntry 
                    ? 'bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-500/20' 
                    : 'bg-amber-600 hover:bg-amber-500 shadow-lg shadow-amber-500/20'
                } disabled:opacity-50`}
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Confirmar Operação
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
