import { Package, AlertTriangle, Clock, ArrowRightLeft, ShoppingCart } from 'lucide-react';

export default function FarmaciaDashboard() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white tracking-tight">Dashboard: Farmácia Central</h1>
        <button className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium text-sm transition-colors shadow-lg shadow-emerald-500/20">
          + Nova Movimentação
        </button>
      </div>

      {/* Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-6 bg-zinc-900/50 rounded-2xl border border-white/5 backdrop-blur-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-emerald-500/10 rounded-xl">
              <Package className="w-6 h-6 text-emerald-400" />
            </div>
            <h3 className="text-sm font-medium text-zinc-400">Total em Estoque</h3>
          </div>
          <p className="text-3xl font-bold text-white">4.231 <span className="text-sm text-zinc-500 font-normal">itens</span></p>
        </div>

        <div className="p-6 bg-zinc-900/50 rounded-2xl border border-white/5 backdrop-blur-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-amber-500/10 rounded-xl">
              <AlertTriangle className="w-6 h-6 text-amber-400" />
            </div>
            <h3 className="text-sm font-medium text-zinc-400">Estoque Crítico</h3>
          </div>
          <p className="text-3xl font-bold text-white">12 <span className="text-sm text-zinc-500 font-normal">produtos</span></p>
        </div>

        <div className="p-6 bg-zinc-900/50 rounded-2xl border border-white/5 backdrop-blur-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full blur-2xl -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-red-500/10 rounded-xl">
              <Clock className="w-6 h-6 text-red-400" />
            </div>
            <h3 className="text-sm font-medium text-zinc-400">Vencimento (30d)</h3>
          </div>
          <p className="text-3xl font-bold text-white">5 <span className="text-sm text-zinc-500 font-normal">lotes</span></p>
        </div>

        <div className="p-6 bg-zinc-900/50 rounded-2xl border border-white/5 backdrop-blur-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-2xl -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-cyan-500/10 rounded-xl">
              <ArrowRightLeft className="w-6 h-6 text-cyan-400" />
            </div>
            <h3 className="text-sm font-medium text-zinc-400">Transferências</h3>
          </div>
          <p className="text-3xl font-bold text-white">3 <span className="text-sm text-zinc-500 font-normal">pendentes</span></p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 p-6 bg-zinc-900/50 rounded-2xl border border-white/5 backdrop-blur-sm">
          <h2 className="text-lg font-bold text-white mb-4">Últimas Movimentações</h2>
          <div className="space-y-3">
            {[1,2,3,4].map((i) => (
              <div key={i} className="flex items-center justify-between p-4 bg-black/20 rounded-xl border border-white/5">
                <div className="flex items-center gap-4">
                  <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                  <div>
                    <p className="text-sm font-medium text-white">Dipirona Sódica 500mg</p>
                    <p className="text-xs text-zinc-500">Lote: L-2026-X • Há 2 horas</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-sm font-bold text-emerald-400">+500 un</p>
                  <p className="text-xs text-zinc-500">Entrada</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="p-6 bg-zinc-900/50 rounded-2xl border border-white/5 backdrop-blur-sm">
          <h2 className="text-lg font-bold text-white mb-4">Ações Rápidas</h2>
          <div className="space-y-3">
            <button className="w-full text-left p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all text-sm font-medium text-zinc-300 hover:text-white flex items-center justify-between group">
              Registrar Saída
              <ArrowRightLeft className="w-4 h-4 text-zinc-500 group-hover:text-emerald-400 transition-colors" />
            </button>
            <button className="w-full text-left p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all text-sm font-medium text-zinc-300 hover:text-white flex items-center justify-between group">
              Realizar Inventário
              <Package className="w-4 h-4 text-zinc-500 group-hover:text-emerald-400 transition-colors" />
            </button>
            <button className="w-full text-left p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 transition-all text-sm font-medium text-zinc-300 hover:text-white flex items-center justify-between group">
              Solicitar Compra
              <ShoppingCart className="w-4 h-4 text-zinc-500 group-hover:text-emerald-400 transition-colors" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
