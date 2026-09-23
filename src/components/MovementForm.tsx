'use client';

import { useState } from 'react';
import { MovementType } from '@/generated/prisma';
import { processInventoryMovement } from '@/actions/inventory';
import { Loader2, ArrowDownCircle, ArrowUpCircle } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface Item {
  id: string;
  name: string;
  sku: string;
}

interface MovementFormProps {
  items: Item[];
}

export default function MovementForm({ items }: MovementFormProps) {
  const [itemId, setItemId] = useState('');
  const [quantity, setQuantity] = useState<number | ''>('');
  const [type, setType] = useState<MovementType>(MovementType.OUT);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const router = useRouter();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!itemId || !quantity || quantity <= 0) return;

    setLoading(true);
    setError('');
    setSuccess(false);

    try {
      await processInventoryMovement(itemId, Number(quantity), type);
      setSuccess(true);
      setItemId('');
      setQuantity('');
      router.refresh(); // Atualiza os dados do servidor na página atual
    } catch (err: any) {
      setError(err.message || 'Erro ao processar movimentação.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      <div className="px-6 py-5 border-b border-slate-200 bg-slate-50">
        <h3 className="text-lg font-medium leading-6 text-slate-900">Registrar Movimentação</h3>
        <p className="mt-1 text-sm text-slate-500">
          Dê entrada ou saída de itens no estoque do seu setor.
        </p>
      </div>
      <div className="px-6 py-5">
        <form onSubmit={handleSubmit} className="space-y-6">
          {error && (
            <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-md">
              <p className="text-sm text-red-700 font-medium">{error}</p>
            </div>
          )}
          {success && (
            <div className="bg-green-50 border-l-4 border-green-500 p-4 rounded-md">
              <p className="text-sm text-green-700 font-medium">Movimentação registrada com sucesso!</p>
            </div>
          )}

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label htmlFor="type" className="block text-sm font-medium text-slate-700">Tipo de Operação</label>
              <div className="mt-1 grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setType(MovementType.IN)}
                  className={`flex items-center justify-center px-4 py-2 border rounded-lg text-sm font-medium transition-colors ${
                    type === MovementType.IN
                      ? 'bg-blue-50 border-blue-600 text-blue-700'
                      : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <ArrowDownCircle className="w-4 h-4 mr-2" />
                  Entrada
                </button>
                <button
                  type="button"
                  onClick={() => setType(MovementType.OUT)}
                  className={`flex items-center justify-center px-4 py-2 border rounded-lg text-sm font-medium transition-colors ${
                    type === MovementType.OUT
                      ? 'bg-orange-50 border-orange-600 text-orange-700'
                      : 'bg-white border-slate-300 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  <ArrowUpCircle className="w-4 h-4 mr-2" />
                  Saída
                </button>
              </div>
            </div>

            <div>
              <label htmlFor="item" className="block text-sm font-medium text-slate-700">Item</label>
              <select
                id="item"
                required
                value={itemId}
                onChange={(e) => setItemId(e.target.value)}
                className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-slate-300 focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm rounded-lg"
              >
                <option value="" disabled>Selecione um item...</option>
                {items.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.name} ({item.sku})
                  </option>
                ))}
              </select>
            </div>

            <div className="sm:col-span-2">
              <label htmlFor="quantity" className="block text-sm font-medium text-slate-700">Quantidade</label>
              <input
                type="number"
                id="quantity"
                min="1"
                required
                value={quantity}
                onChange={(e) => setQuantity(e.target.value ? Number(e.target.value) : '')}
                className="mt-1 block w-full px-3 py-2 border border-slate-300 rounded-lg shadow-sm focus:outline-none focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              />
            </div>
          </div>

          <div className="flex justify-end pt-2">
            <button
              type="submit"
              disabled={loading || !itemId || !quantity}
              className="inline-flex justify-center items-center py-2 px-6 border border-transparent shadow-sm text-sm font-medium rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-colors"
            >
              {loading && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              Confirmar Movimentação
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
