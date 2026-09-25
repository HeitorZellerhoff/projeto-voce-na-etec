'use client';

import { useState } from 'react';
import { X, Loader2, ShoppingCart, ShieldAlert, Plus, Trash2 } from 'lucide-react';
import { Supplier, Product } from '@/generated/prisma';

interface CreatePurchaseModalProps {
  isOpen: boolean;
  onClose: () => void;
  suppliers: Supplier[];
  products: Product[];
  onSuccess: () => void;
}

export function CreatePurchaseModal({
  isOpen,
  onClose,
  suppliers,
  products,
  onSuccess,
}: CreatePurchaseModalProps) {
  const [supplierId, setSupplierId] = useState(suppliers[0]?.id || '');
  const [items, setItems] = useState([
    { productId: products[0]?.id || '', quantity: 100, unitPrice: 5.5 }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const handleAddItem = () => {
    setItems([...items, { productId: products[0]?.id || '', quantity: 50, unitPrice: 10 }]);
  };

  const handleRemoveItem = (index: number) => {
    if (items.length > 1) {
      setItems(items.filter((_, i) => i !== index));
    }
  };

  const handleItemChange = (index: number, field: string, value: any) => {
    const updated = [...items];
    (updated[index] as any)[field] = value;
    setItems(updated);
  };

  const totalCalculated = items.reduce((sum, item) => sum + (item.quantity * item.unitPrice), 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      if (!supplierId) {
        throw new Error('Selecione um fornecedor homologado');
      }

      const res = await fetch('/api/purchases', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplierId,
          totalAmount: totalCalculated,
          items: items.map(i => ({
            productId: i.productId,
            quantity: Number(i.quantity),
            unitPrice: Number(i.unitPrice),
          })),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao gerar solicitação de compra');
      }

      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro inesperado ao gerar pedido');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-zinc-900 border border-white/10 rounded-2xl w-full max-w-xl shadow-2xl overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-amber-500 to-cyan-500"></div>

        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-xl">
                <ShoppingCart className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white tracking-tight">Nova Solicitação de Compra</h2>
                <p className="text-xs text-zinc-400">Emissão de ordem de aquisição com controle de SoD</p>
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
              <label className="block text-xs font-medium text-zinc-300 mb-1">Fornecedor Homologado</label>
              <select
                value={supplierId}
                onChange={(e) => setSupplierId(e.target.value)}
                className="w-full px-3 py-2.5 bg-black/50 border border-white/10 rounded-xl text-white text-sm outline-none focus:border-amber-500 transition-colors"
              >
                {suppliers.map((s) => (
                  <option key={s.id} value={s.id} className="bg-zinc-900">
                    {s.name} ({s.cnpj})
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between">
                <label className="text-xs font-medium text-zinc-300">Itens da Solicitação</label>
                <button
                  type="button"
                  onClick={handleAddItem}
                  className="text-xs text-amber-400 hover:text-amber-300 flex items-center gap-1 font-medium transition-colors"
                >
                  <Plus className="w-3.5 h-3.5" /> Adicionar Item
                </button>
              </div>

              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {items.map((item, index) => (
                  <div key={index} className="flex items-center gap-2 p-2.5 bg-black/30 border border-white/5 rounded-xl">
                    <select
                      value={item.productId}
                      onChange={(e) => handleItemChange(index, 'productId', e.target.value)}
                      className="flex-1 px-2.5 py-1.5 bg-zinc-900 border border-white/10 rounded-lg text-white text-xs outline-none focus:border-amber-500"
                    >
                      {products.map((p) => (
                        <option key={p.id} value={p.id} className="bg-zinc-900">
                          {p.name}
                        </option>
                      ))}
                    </select>

                    <div className="w-20">
                      <input
                        type="number"
                        min="1"
                        placeholder="Qtd"
                        value={item.quantity}
                        onChange={(e) => handleItemChange(index, 'quantity', parseInt(e.target.value, 10) || 1)}
                        className="w-full px-2 py-1.5 bg-zinc-900 border border-white/10 rounded-lg text-white text-xs outline-none focus:border-amber-500 text-center"
                      />
                    </div>

                    <div className="w-24">
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        placeholder="R$ Unit"
                        value={item.unitPrice}
                        onChange={(e) => handleItemChange(index, 'unitPrice', parseFloat(e.target.value) || 0)}
                        className="w-full px-2 py-1.5 bg-zinc-900 border border-white/10 rounded-lg text-white text-xs outline-none focus:border-amber-500 text-center"
                      />
                    </div>

                    {items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveItem(index)}
                        className="p-1.5 text-zinc-500 hover:text-red-400 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="p-3 bg-black/40 rounded-xl border border-white/5 flex items-center justify-between text-sm">
              <span className="text-zinc-400">Total Estimado do Pedido:</span>
              <span className="text-base font-bold text-amber-400 font-mono">
                {totalCalculated.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
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
                className="px-5 py-2 text-sm font-semibold text-white bg-amber-600 hover:bg-amber-500 rounded-xl transition-all shadow-lg shadow-amber-500/20 disabled:opacity-50 flex items-center gap-2"
              >
                {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                Criar Ordem de Compra
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
