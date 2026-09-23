import { ShieldAlert, LogIn } from 'lucide-react';
import Link from 'next/link';

export default function ForbiddenPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4">
      <div className="w-full max-w-md bg-zinc-900/50 p-8 rounded-3xl border border-red-500/20 text-center">
        <div className="inline-flex p-4 bg-red-500/10 rounded-full mb-6">
          <ShieldAlert className="w-12 h-12 text-red-500" />
        </div>
        <h1 className="text-2xl font-bold text-white mb-2">Acesso Negado</h1>
        <p className="text-sm text-zinc-400 mb-8">
          Você está tentando acessar um setor ou recurso para o qual sua conta não possui autorização ou vínculo atual. A tentativa foi registrada no log de segurança.
        </p>
        <Link href="/dashboard" className="inline-flex items-center justify-center gap-2 px-6 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl transition-colors font-medium">
          Voltar para meu Setor
        </Link>
      </div>
    </div>
  );
}
