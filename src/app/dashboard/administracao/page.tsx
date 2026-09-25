import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import { 
  Users, 
  ShieldCheck, 
  Package, 
  ShoppingCart, 
  AlertTriangle, 
  Clock, 
  ArrowRight, 
  Activity, 
  Layers, 
  CheckCircle2,
  Lock
} from 'lucide-react';

export default async function AdministracaoDashboard() {
  const session = await getSession();
  if (!session) redirect('/login');

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    include: { role: true, sector: true },
  });

  if (!user) redirect('/login');

  // Permitir apenas ADMINISTRADOR ou usuários do setor de administração
  if (user.role.name !== 'ADMINISTRADOR' && user.sector.code !== 'ADMINISTRACAO') {
    redirect('/403-acesso-negado');
  }

  // Buscar métricas globais para visão executiva
  const [
    totalUsers,
    activeUsers,
    blockedUsers,
    totalSectors,
    totalProducts,
    pendingPurchases,
    recentAudits,
    recentUsers
  ] = await Promise.all([
    prisma.user.count(),
    prisma.user.count({ where: { status: 'ATIVO' } }),
    prisma.user.count({ where: { status: 'BLOQUEADO' } }),
    prisma.sector.count({ where: { status: 'ATIVO' } }),
    prisma.product.count({ where: { status: 'ATIVO' } }),
    prisma.purchase.count({ where: { status: 'PENDENTE_APROVACAO' } }),
    prisma.auditLog.findMany({
      take: 6,
      orderBy: { createdAt: 'desc' },
    }),
    prisma.user.findMany({
      take: 4,
      orderBy: { createdAt: 'desc' },
      include: { role: true, sector: true },
    })
  ]);

  return (
    <div className="space-y-8">
      {/* Header Executivo */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/5 pb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              Painel Executivo
            </span>
            <span className="text-xs text-zinc-500 flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse"></span>
              Todos os sistemas operacionais
            </span>
          </div>
          <h1 className="text-3xl font-bold text-white tracking-tight">Administração Geral</h1>
          <p className="text-sm text-zinc-400 mt-1">
            Supervisão corporativa, governança de acessos (IAM) e métricas consolidadas dos setores.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/admin/usuarios"
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium text-sm transition-all shadow-lg shadow-emerald-500/20"
          >
            <Users className="w-4 h-4" />
            Gerenciar Usuários (IAM)
          </Link>
        </div>
      </div>

      {/* Cards de Métricas Principais */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* IAM & Colaboradores */}
        <div className="p-6 bg-zinc-900/50 rounded-2xl border border-white/5 backdrop-blur-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 rounded-full blur-2xl -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400">
              <Users className="w-6 h-6" />
            </div>
            <span className="text-xs font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded-md border border-emerald-500/20">
              {activeUsers} Ativos
            </span>
          </div>
          <h3 className="text-sm font-medium text-zinc-400">Colaboradores</h3>
          <p className="text-3xl font-bold text-white mt-1">
            {totalUsers} <span className="text-sm text-zinc-500 font-normal">registrados</span>
          </p>
          {blockedUsers > 0 && (
            <p className="text-xs text-red-400 mt-2 flex items-center gap-1">
              <Lock className="w-3 h-3" /> {blockedUsers} usuário(s) bloqueado(s)
            </p>
          )}
        </div>

        {/* Setores Ativos */}
        <div className="p-6 bg-zinc-900/50 rounded-2xl border border-white/5 backdrop-blur-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 rounded-full blur-2xl -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-blue-500/10 rounded-xl text-blue-400">
              <Layers className="w-6 h-6" />
            </div>
            <span className="text-xs font-semibold text-blue-400 bg-blue-500/10 px-2 py-1 rounded-md border border-blue-500/20">
              Integrados
            </span>
          </div>
          <h3 className="text-sm font-medium text-zinc-400">Setores Operacionais</h3>
          <p className="text-3xl font-bold text-white mt-1">
            {totalSectors} <span className="text-sm text-zinc-500 font-normal">unidades</span>
          </p>
          <p className="text-xs text-zinc-500 mt-2">Farmácia • Almoxarifado • Compras</p>
        </div>

        {/* Catálogo de Produtos */}
        <div className="p-6 bg-zinc-900/50 rounded-2xl border border-white/5 backdrop-blur-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-purple-500/5 rounded-full blur-2xl -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-purple-500/10 rounded-xl text-purple-400">
              <Package className="w-6 h-6" />
            </div>
            <span className="text-xs font-semibold text-purple-400 bg-purple-500/10 px-2 py-1 rounded-md border border-purple-500/20">
              Inventário
            </span>
          </div>
          <h3 className="text-sm font-medium text-zinc-400">Produtos Cadastrados</h3>
          <p className="text-3xl font-bold text-white mt-1">
            {totalProducts} <span className="text-sm text-zinc-500 font-normal">itens ativos</span>
          </p>
          <p className="text-xs text-zinc-500 mt-2">Estoque central e dispensação</p>
        </div>

        {/* Requisições Pendentes */}
        <div className="p-6 bg-zinc-900/50 rounded-2xl border border-white/5 backdrop-blur-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-2xl -mr-10 -mt-10 transition-transform group-hover:scale-150"></div>
          <div className="flex items-center justify-between mb-4">
            <div className="p-3 bg-amber-500/10 rounded-xl text-amber-400">
              <ShoppingCart className="w-6 h-6" />
            </div>
            <span className={`text-xs font-semibold px-2 py-1 rounded-md border ${
              pendingPurchases > 0 
                ? 'text-amber-400 bg-amber-500/10 border-amber-500/20 animate-pulse' 
                : 'text-zinc-400 bg-white/5 border-white/10'
            }`}>
              {pendingPurchases > 0 ? 'Requer Ação' : 'Regular'}
            </span>
          </div>
          <h3 className="text-sm font-medium text-zinc-400">Compras Pendentes</h3>
          <p className="text-3xl font-bold text-white mt-1">
            {pendingPurchases} <span className="text-sm text-zinc-500 font-normal">aguardando</span>
          </p>
          <p className="text-xs text-zinc-500 mt-2">Aprovação por Segregação de Funções</p>
        </div>
      </div>

      {/* Acesso Rápido aos Setores Hospitalares */}
      <div>
        <h2 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
          <Activity className="w-5 h-5 text-emerald-400" />
          Acesso aos Módulos Setoriais
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {/* Card Farmácia */}
          <Link
            href="/dashboard/farmacia"
            className="group p-6 bg-zinc-900/40 hover:bg-zinc-900/80 border border-white/5 hover:border-emerald-500/30 rounded-2xl transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="p-3 bg-emerald-500/10 rounded-xl text-emerald-400 group-hover:scale-110 transition-transform">
                  <Package className="w-6 h-6" />
                </div>
                <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
              </div>
              <h3 className="text-base font-semibold text-white group-hover:text-emerald-300 transition-colors">
                Farmácia Central
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                Controle de lotes, dispensação hospitalar, validades e estoques críticos de medicamentos.
              </p>
            </div>
            <div className="mt-5 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-zinc-500">
              <span>Status Operacional</span>
              <span className="text-emerald-400 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Ativo
              </span>
            </div>
          </Link>

          {/* Card Almoxarifado */}
          <Link
            href="/dashboard/almoxarifado"
            className="group p-6 bg-zinc-900/40 hover:bg-zinc-900/80 border border-white/5 hover:border-emerald-500/30 rounded-2xl transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="p-3 bg-cyan-500/10 rounded-xl text-cyan-400 group-hover:scale-110 transition-transform">
                  <Layers className="w-6 h-6" />
                </div>
                <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-cyan-400 group-hover:translate-x-1 transition-all" />
              </div>
              <h3 className="text-base font-semibold text-white group-hover:text-cyan-300 transition-colors">
                Almoxarifado Geral
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                Recepção de cargas, movimentações internas, transferências entre setores e armazém geral.
              </p>
            </div>
            <div className="mt-5 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-zinc-500">
              <span>Status Operacional</span>
              <span className="text-emerald-400 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Ativo
              </span>
            </div>
          </Link>

          {/* Card Compras */}
          <Link
            href="/dashboard/compras"
            className="group p-6 bg-zinc-900/40 hover:bg-zinc-900/80 border border-white/5 hover:border-emerald-500/30 rounded-2xl transition-all flex flex-col justify-between"
          >
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="p-3 bg-amber-500/10 rounded-xl text-amber-400 group-hover:scale-110 transition-transform">
                  <ShoppingCart className="w-6 h-6" />
                </div>
                <ArrowRight className="w-4 h-4 text-zinc-600 group-hover:text-amber-400 group-hover:translate-x-1 transition-all" />
              </div>
              <h3 className="text-base font-semibold text-white group-hover:text-amber-300 transition-colors">
                Departamento de Compras
              </h3>
              <p className="text-xs text-zinc-400 mt-1">
                Ordens de compra, homologação de fornecedores e controle do fluxo de aquisição e cotações.
              </p>
            </div>
            <div className="mt-5 pt-3 border-t border-white/5 flex items-center justify-between text-xs text-zinc-500">
              <span>Status Operacional</span>
              <span className="text-emerald-400 font-medium flex items-center gap-1">
                <CheckCircle2 className="w-3.5 h-3.5" /> Ativo
              </span>
            </div>
          </Link>
        </div>
      </div>

      {/* Grid: Usuários Recentes & Trilha de Auditoria */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gestão de Identidades Rápida */}
        <div className="p-6 bg-zinc-900/50 rounded-2xl border border-white/5 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-white">Últimos Colaboradores Cadastrados</h3>
              <p className="text-xs text-zinc-500">Contas criadas recentemente na base corporativa</p>
            </div>
            <Link
              href="/dashboard/admin/usuarios"
              className="text-xs text-emerald-400 hover:text-emerald-300 font-medium flex items-center gap-1 transition-colors"
            >
              Ver todos <ArrowRight className="w-3 h-3" />
            </Link>
          </div>

          <div className="space-y-3">
            {recentUsers.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between p-3.5 bg-black/20 rounded-xl border border-white/5 hover:border-white/10 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-emerald-500/10 text-emerald-400 flex items-center justify-center font-bold text-xs">
                    {u.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">{u.name}</p>
                    <p className="text-xs text-zinc-500">{u.email} • {u.role.name}</p>
                  </div>
                </div>

                <div className="text-right">
                  <span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${
                    u.status === 'ATIVO'
                      ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20'
                      : 'bg-red-500/10 text-red-400 border border-red-500/20'
                  }`}>
                    {u.status}
                  </span>
                  <p className="text-[10px] text-zinc-600 mt-0.5">{u.sector.name}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Trilha de Auditoria (Audit Log) */}
        <div className="p-6 bg-zinc-900/50 rounded-2xl border border-white/5 backdrop-blur-sm">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="text-base font-bold text-white">Trilha de Auditoria e Segurança</h3>
              <p className="text-xs text-zinc-500">Últimos eventos rastreados no sistema</p>
            </div>
            <span className="text-xs text-zinc-500 flex items-center gap-1">
              <Clock className="w-3 h-3" /> Tempo Real
            </span>
          </div>

          <div className="space-y-3">
            {recentAudits.length === 0 ? (
              <p className="text-xs text-zinc-500 py-6 text-center">Nenhum evento de auditoria registrado ainda.</p>
            ) : (
              recentAudits.map((log) => (
                <div
                  key={log.id}
                  className="flex items-center justify-between p-3.5 bg-black/20 rounded-xl border border-white/5"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                    <div>
                      <p className="text-xs font-semibold text-zinc-200">{log.action}</p>
                      <p className="text-[11px] text-zinc-500">
                        Entidade: {log.entity} {log.entityId ? `• ID: ${log.entityId.slice(0, 8)}...` : ''}
                      </p>
                    </div>
                  </div>
                  <span className="text-[11px] text-zinc-500">
                    {new Date(log.createdAt).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
