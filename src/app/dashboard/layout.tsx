import { ReactNode } from 'react';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { LayoutDashboard, Package, ShoppingCart, LogOut, FileText } from 'lucide-react';
import Link from 'next/link';

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const session = await getSession();
  if (!session) redirect('/login');

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    include: {
      role: true,
      sector: true,
    }
  });

  if (!user) redirect('/login');

  const sectorSlug = user.sector.code.toLowerCase();

  return (
    <div className="flex h-screen bg-zinc-950 text-slate-200 overflow-hidden font-sans">
      {/* Sidebar Corporativa */}
      <aside className="w-64 bg-zinc-900 border-r border-white/5 flex flex-col relative z-20 shadow-2xl">
        <div className="h-16 flex items-center px-6 border-b border-white/5 bg-zinc-950/50">
          <div className="flex items-center gap-2 text-emerald-400 font-semibold text-lg tracking-tight">
            <LayoutDashboard className="w-5 h-5" />
            <span>Hospital ERP</span>
          </div>
        </div>
        
        <nav className="flex-1 p-4 space-y-1.5 overflow-y-auto">
          <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3 px-2">Menu Principal</div>
          
          <Link href={`/dashboard/${sectorSlug}`} className="flex items-center gap-3 px-3 py-2.5 rounded-lg bg-emerald-500/10 text-emerald-400 font-medium hover:bg-emerald-500/20 transition-all border border-emerald-500/20">
            <Package className="w-4 h-4" />
            Meu Setor
          </Link>

          {user.role.name === 'ADMINISTRADOR' && (
             <div className="pt-4 mt-4 border-t border-white/5 space-y-1.5">
               <div className="text-xs font-semibold text-zinc-500 uppercase tracking-wider mb-3 px-2">Administração</div>
               <Link href={`/dashboard/farmacia`} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-zinc-400 font-medium hover:bg-white/5 hover:text-white transition-all">
                 <Package className="w-4 h-4" /> Farmácia
               </Link>
               <Link href={`/dashboard/almoxarifado`} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-zinc-400 font-medium hover:bg-white/5 hover:text-white transition-all">
                 <Package className="w-4 h-4" /> Almoxarifado
               </Link>
               <Link href={`/dashboard/compras`} className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-zinc-400 font-medium hover:bg-white/5 hover:text-white transition-all">
                 <ShoppingCart className="w-4 h-4" /> Compras
               </Link>
             </div>
          )}
        </nav>

        <div className="p-4 border-t border-white/5 bg-zinc-950/50">
          <form action="/api/auth/logout" method="POST">
            <button type="submit" className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-red-500/10 text-red-400 hover:bg-red-500/20 rounded-lg transition-colors font-medium text-sm border border-red-500/20">
              <LogOut className="w-4 h-4" />
              Sair do Sistema
            </button>
          </form>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col overflow-hidden relative bg-zinc-950">
        <div className="absolute top-0 left-0 w-full h-[500px] bg-emerald-900/10 blur-[120px] pointer-events-none -z-10"></div>
        
        {/* Header Dinâmico (Badge) */}
        <header className="h-16 flex items-center justify-between px-8 border-b border-white/5 bg-zinc-900/40 backdrop-blur-xl z-10 shadow-sm">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-semibold text-zinc-300">Painel Operacional Automático</h2>
          </div>
          
          <div className="flex items-center gap-4">
            <div className="px-5 py-2 bg-black/40 rounded-full border border-white/10 flex items-center gap-2 text-xs shadow-inner">
              <div className="w-2 h-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.8)] animate-pulse"></div>
              <span className="font-bold text-white tracking-wide">{user.name}</span>
              <span className="text-zinc-600">|</span>
              <span className="text-emerald-400 font-medium">{user.role.name}</span>
              <span className="text-zinc-600">—</span>
              <span className="text-zinc-400">Setor: <span className="text-white font-medium">{user.sector.name}</span></span>
            </div>
          </div>
        </header>

        <div className="flex-1 overflow-auto p-8 z-10 relative">
          {children}
        </div>
      </main>
    </div>
  );
}
