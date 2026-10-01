'use client';

import { useState } from 'react';
import Link from 'next/link';
import { KeyRound, ArrowLeft, Loader2, CheckCircle2, ShieldAlert } from 'lucide-react';

export default function EsqueciMinhaSenhaPage() {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: email.trim().toLowerCase() }),
      });

      const data = await res.json();

      if (!res.ok && res.status !== 202) {
        throw new Error(data.error || 'Erro ao processar a solicitação');
      }

      setSubmitted(true);
    } catch (err: any) {
      setError(err.message || 'Erro inesperado ao solicitar recuperação de senha');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-slate-100 p-4 selection:bg-emerald-500/30">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-900/20 via-zinc-950 to-zinc-950"></div>

      <div className="w-full max-w-md relative z-10 backdrop-blur-xl bg-zinc-900/50 p-8 rounded-3xl border border-white/10 shadow-2xl overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-cyan-500"></div>

        <div className="flex flex-col items-center mb-8">
          <div className="p-3 bg-emerald-500/10 rounded-2xl mb-4">
            <KeyRound className="w-10 h-10 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-white">Recuperação de Acesso</h1>
          <p className="text-sm text-zinc-400 mt-1 text-center">
            Informe seu e-mail institucional cadastrado para receber as instruções seguras de redefinição.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center gap-3">
            <ShieldAlert className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {submitted ? (
          <div className="space-y-6 text-center animate-in fade-in zoom-in-95">
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400 text-sm flex flex-col items-center gap-3">
              <CheckCircle2 className="w-8 h-8 text-emerald-400" />
              <div className="leading-relaxed">
                Se o e-mail informado estiver ativo no quadro hospitalar, um link de uso único com validade de <strong>1 hora</strong> foi emitido com segurança.
              </div>
            </div>

            <div className="text-xs text-zinc-500 leading-relaxed">
              Verifique sua caixa de entrada e pasta de spam. Por motivos de segurança, nenhuma informação de cadastro foi revelada nesta tela.
            </div>

            <Link
              href="/login"
              className="inline-flex items-center justify-center gap-2 w-full py-3.5 bg-white/5 hover:bg-white/10 text-white rounded-xl font-medium transition-colors border border-white/10"
            >
              <ArrowLeft className="w-4 h-4" />
              Voltar para o Login
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-sm font-medium text-zinc-300">E-mail corporativo</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 bg-black/50 border border-white/5 rounded-xl focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all outline-none text-white placeholder:text-zinc-600"
                placeholder="seu.nome@hospital.com"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.98] disabled:opacity-70 flex items-center justify-center gap-2 mt-4"
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Enviar Instruções'}
            </button>

            <div className="pt-2 text-center">
              <Link
                href="/login"
                className="inline-flex items-center gap-2 text-xs text-zinc-400 hover:text-white transition-colors"
              >
                <ArrowLeft className="w-3.5 h-3.5" />
                Voltar para o Login
              </Link>
            </div>
          </form>
        )}

        <div className="mt-8 text-center text-xs text-zinc-500">
          Hospital Logistics Security • Todas as tentativas de recuperação são auditadas.
        </div>
      </div>
    </div>
  );
}
