import { ShoppingCart, CheckCircle, Clock, FileText } from 'lucide-react';

export default function ComprasDashboard() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white tracking-tight">Dashboard: Departamento de Compras</h1>
        <button className="px-4 py-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-lg font-medium text-sm transition-colors shadow-lg shadow-cyan-500/20">
          + Nova Cotação
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-6 bg-zinc-900/50 rounded-2xl border border-white/5 backdrop-blur-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-amber-500/10 rounded-xl">
              <Clock className="w-6 h-6 text-amber-400" />
            </div>
            <h3 className="text-sm font-medium text-zinc-400">Aguardando Aprovação (SoD)</h3>
          </div>
          <p className="text-3xl font-bold text-white">7 <span className="text-sm text-zinc-500 font-normal">pedidos</span></p>
        </div>

        <div className="p-6 bg-zinc-900/50 rounded-2xl border border-white/5 backdrop-blur-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-2xl -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-cyan-500/10 rounded-xl">
              <ShoppingCart className="w-6 h-6 text-cyan-400" />
            </div>
            <h3 className="text-sm font-medium text-zinc-400">Em Trânsito (Fornecedor)</h3>
          </div>
          <p className="text-3xl font-bold text-white">12 <span className="text-sm text-zinc-500 font-normal">pedidos</span></p>
        </div>

        <div className="p-6 bg-zinc-900/50 rounded-2xl border border-white/5 backdrop-blur-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-emerald-500/10 rounded-xl">
              <CheckCircle className="w-6 h-6 text-emerald-400" />
            </div>
            <h3 className="text-sm font-medium text-zinc-400">Compras Entregues (Mês)</h3>
          </div>
          <p className="text-3xl font-bold text-white">45 <span className="text-sm text-zinc-500 font-normal">concluídas</span></p>
        </div>
      </div>

      <div className="p-6 bg-zinc-900/50 rounded-2xl border border-white/5 backdrop-blur-sm mt-6">
        <h2 className="text-lg font-bold text-white mb-4">Histórico Recente e Cotações</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-zinc-400">
            <thead className="text-xs text-zinc-500 uppercase bg-black/20 border-b border-white/5">
              <tr>
                <th className="px-4 py-3 font-medium">ID da Compra</th>
                <th className="px-4 py-3 font-medium">Fornecedor</th>
                <th className="px-4 py-3 font-medium">Valor Total</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Ação</th>
              </tr>
            </thead>
            <tbody>
              {[1,2,3].map(i => (
                <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="px-4 py-4 text-white font-medium">#COMP-2026-{900+i}</td>
                  <td className="px-4 py-4">MedSupply Distribuidora Ltda</td>
                  <td className="px-4 py-4 font-mono">R$ 14.500,00</td>
                  <td className="px-4 py-4">
                    <span className="px-2.5 py-1 text-xs font-medium bg-amber-500/10 text-amber-400 rounded-full border border-amber-500/20">
                      Pendente Aprovação
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <button className="text-cyan-400 hover:text-cyan-300 font-medium">Revisar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
