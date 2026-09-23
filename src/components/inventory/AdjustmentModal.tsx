'use client';

import { useState } from 'react';
import { X, Loader2, Edit3, ArrowRight } from 'lucide-react';
import { z } from 'zod';

interface AdjustmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  productId: string;
  productName: string;
  previousBalance: number;
  onSuccess: () => void;
}

const adjustmentSchema = z.object({
  newQuantity: z.number().int().min(0, 'A quantidade não pode ser negativa'),
  reason: z.string().min(5, 'A justificativa deve ser detalhada'),
  observation: z.string().optional(),
});

export function AdjustmentModal({ isOpen, onClose, productId, productName, previousBalance, onSuccess }: AdjustmentModalProps) {
  const [newQuantity, setNewQuantity] = useState<string>(previousBalance.toString());
  const [reason, setReason] = useState('');
  const [observation, setObservation] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const currentNewQuantity = parseInt(newQuantity, 10) || 0;
  const delta = currentNewQuantity - previousBalance;
  
  const isPositiveDelta = delta > 0;
  const isNegativeDelta = delta < 0;
  const isNeutralDelta = delta === 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isNeutralDelta) {
      return setError('Não há diferença no saldo para ser ajustada.');
    }
    
    setIsLoading(true);
    setError('');

    try {
      const parsed = adjustmentSchema.parse({
        newQuantity: currentNewQuantity,
        reason,
        observation
      });

      const res = await fetch('/api/inventory/adjustment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...parsed, productId })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || data.error || 'Erro ao processar o ajuste');
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4 animate-in fade-in">
      <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-lg shadow-[0_0_40px_rgba(0,0,0,0.5)] overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-red-500 to-amber-500"></div>
        
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10 text-red-400">
                <Edit3 className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Ajuste Manual de Saldo</h2>
                <p className="text-xs text-zinc-400">{productName}</p>
              </div>
            </div>
            <button onClick={onClose} disabled={isLoading} className="text-zinc-500 hover:text-white transition-colors">
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="bg-black/30 rounded-xl p-4 mb-6 border border-white/5 flex items-center justify-between">
            <div className="text-center">
              <p className="text-xs text-zinc-500 mb-1">Saldo Sistema</p>
              <p className="text-xl font-mono text-white">{previousBalance}</p>
            </div>
            <ArrowRight className="w-5 h-5 text-zinc-600" />
            <div className="text-center">
              <p className="text-xs text-zinc-500 mb-1">Saldo Físico (Novo)</p>
              <p className="text-xl font-mono text-amber-400">{currentNewQuantity}</p>
            </div>
            <ArrowRight className="w-5 h-5 text-zinc-600" />
            <div className="text-center">
              <p className="text-xs text-zinc-500 mb-1">Impacto (Delta)</p>
              <p className={`text-xl font-mono ${isPositiveDelta ? 'text-emerald-400' : isNegativeDelta ? 'text-red-400' : 'text-zinc-500'}`}>
                {isPositiveDelta ? '+' : ''}{delta}
              </p>
            </div>
          </div>

          {error && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
              {error}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-medium text-zinc-300">Quantidade Real Apurada</label>
              <input 
                type="number"
                min="0"
                value={newQuantity}
                onChange={(e) => setNewQuantity(e.target.value)}
                className="w-full px-3 py-3 mt-1.5 bg-black/50 border border-white/5 rounded-xl text-amber-400 font-mono text-lg outline-none focus:border-amber-500 transition-colors"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300">Justificativa Regulatória (Obrigatória)</label>
              <input 
                type="text"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-3 py-2 bg-black/50 border border-white/5 rounded-lg text-white outline-none focus:border-amber-500 transition-colors placeholder:text-zinc-600"
                placeholder="Ex: Quebra de frasco, inventário rotativo discordante"
                required
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-medium text-zinc-300">Observações de Auditoria</label>
              <textarea 
                value={observation}
                onChange={(e) => setObservation(e.target.value)}
                className="w-full px-3 py-2 bg-black/50 border border-white/5 rounded-lg text-white outline-none focus:border-amber-500 transition-colors min-h-[80px] resize-none placeholder:text-zinc-600"
                placeholder="Nomes de testemunhas, link para laudo técnico..."
              />
            </div>

            <div className="pt-4 flex justify-end gap-3 border-t border-white/5">
              <button 
                type="button"
                onClick={onClose}
                disabled={isLoading}
                className="px-4 py-2 text-sm font-medium text-zinc-300 hover:text-white bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
              >
                Cancelar Ajuste
              </button>
              <button 
                type="submit"
                disabled={isLoading || isNeutralDelta}
                className="px-4 py-2 text-sm font-medium text-white bg-red-600 hover:bg-red-500 shadow-lg shadow-red-500/20 rounded-lg transition-all flex items-center gap-2 disabled:opacity-50"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Consolidar Impacto
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
