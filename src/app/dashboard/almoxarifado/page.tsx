import { Package, Truck, ArrowRightLeft, Database } from 'lucide-react';

export default function AlmoxarifadoDashboard() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white tracking-tight">Dashboard: Almoxarifado Geral</h1>
        <div className="flex gap-3">
          <button className="px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-lg font-medium text-sm transition-colors border border-white/5">
            Gerar Relatório
          </button>
          <button className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-lg font-medium text-sm transition-colors shadow-lg shadow-emerald-500/20">
            Nova Transferência
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-6 bg-zinc-900/50 rounded-2xl border border-white/5 backdrop-blur-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-emerald-500/10 rounded-xl">
              <Database className="w-6 h-6 text-emerald-400" />
            </div>
            <h3 className="text-sm font-medium text-zinc-400">Total Armazenado</h3>
          </div>
          <p className="text-3xl font-bold text-white">15.892 <span className="text-sm text-zinc-500 font-normal">unidades</span></p>
        </div>

        <div className="p-6 bg-zinc-900/50 rounded-2xl border border-white/5 backdrop-blur-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-amber-500/10 rounded-xl">
              <Truck className="w-6 h-6 text-amber-400" />
            </div>
            <h3 className="text-sm font-medium text-zinc-400">Recebimentos Hoje</h3>
          </div>
          <p className="text-3xl font-bold text-white">4 <span className="text-sm text-zinc-500 font-normal">lotes</span></p>
        </div>

        <div className="p-6 bg-zinc-900/50 rounded-2xl border border-white/5 backdrop-blur-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 rounded-full blur-2xl -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
          <div className="flex items-center gap-4 mb-4">
            <div className="p-3 bg-cyan-500/10 rounded-xl">
              <ArrowRightLeft className="w-6 h-6 text-cyan-400" />
            </div>
            <h3 className="text-sm font-medium text-zinc-400">Solicitações de Transferência</h3>
          </div>
          <p className="text-3xl font-bold text-white">18 <span className="text-sm text-zinc-500 font-normal">requisições</span></p>
        </div>
      </div>

      <div className="p-6 bg-zinc-900/50 rounded-2xl border border-white/5 backdrop-blur-sm mt-6">
        <h2 className="text-lg font-bold text-white mb-4">Requisições Pendentes (Transferência)</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-zinc-400">
            <thead className="text-xs text-zinc-500 uppercase bg-black/20 border-b border-white/5">
              <tr>
                <th className="px-4 py-3 font-medium">Produto</th>
                <th className="px-4 py-3 font-medium">Setor Solicitante</th>
                <th className="px-4 py-3 font-medium">Qtd Requisitada</th>
                <th className="px-4 py-3 font-medium text-right">Ação</th>
              </tr>
            </thead>
            <tbody>
              {[1,2,3].map(i => (
                <tr key={i} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                  <td className="px-4 py-4 text-white font-medium">Seringa Descartável 10ml</td>
                  <td className="px-4 py-4">Farmácia Central</td>
                  <td className="px-4 py-4 text-amber-400 font-bold">500 un</td>
                  <td className="px-4 py-4 text-right">
                    <button className="text-emerald-400 hover:text-emerald-300 font-medium">Aprovar Transferência</button>
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
