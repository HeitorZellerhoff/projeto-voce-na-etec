'use client';

import { useState, Suspense } from 'react';

import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Lock, Eye, EyeOff, Loader2, CheckCircle2, ShieldAlert, ArrowLeft } from 'lucide-react';

function RedefinirSenhaForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get('token') || '';
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(token ? '' : 'Link de recuperação inválido ou token não fornecido.');
  const [success, setSuccess] = useState(false);


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!token) {
      setError('Token de recuperação ausente.');
      return;
    }

    if (newPassword.length < 8) {
      setError('A nova senha deve ter no mínimo 8 caracteres.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setError('As senhas digitadas não coincidem.');
      return;
    }

    setLoading(true);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, newPassword }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao redefinir a senha');
      }

      setSuccess(true);
      setTimeout(() => {
        router.push('/login?message=Senha%20alterada%20com%20sucesso');
      }, 3000);
    } catch (err: any) {
      setError(err.message || 'Erro inesperado ao redefinir senha');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md relative z-10 backdrop-blur-xl bg-zinc-900/50 p-8 rounded-3xl border border-white/10 shadow-2xl overflow-hidden">
      <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-emerald-500 to-cyan-500"></div>

      <div className="flex flex-col items-center mb-8">
        <div className="p-3 bg-emerald-500/10 rounded-2xl mb-4">
          <Lock className="w-10 h-10 text-emerald-400" />
        </div>
        <h1 className="text-2xl font-bold tracking-tight text-white">Criar Nova Senha</h1>
        <p className="text-sm text-zinc-400 mt-1 text-center">
          Defina sua nova credencial de acesso aos sistemas hospitalares.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center gap-3">
          <ShieldAlert className="w-5 h-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {success ? (
        <div className="space-y-6 text-center animate-in fade-in zoom-in-95">
          <div className="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl text-emerald-400 text-sm flex flex-col items-center gap-3">
            <CheckCircle2 className="w-8 h-8 text-emerald-400" />
            <div className="font-semibold text-white">Senha Redefinida com Sucesso!</div>
            <div className="text-xs text-zinc-400">
              Redirecionando automaticamente para a tela de autenticação em instantes...
            </div>
          </div>

          <Link
            href="/login"
            className="inline-flex items-center justify-center gap-2 w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium transition-colors shadow-lg shadow-emerald-500/20"
          >
            Ir para o Login Agora
          </Link>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <label className="text-sm font-medium text-zinc-300">Nova Senha</label>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                minLength={8}
                disabled={!token || loading}
                className="w-full px-4 py-3 bg-black/50 border border-white/5 rounded-xl focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all outline-none text-white placeholder:text-zinc-600 pr-12 disabled:opacity-50"
                placeholder="Mínimo 8 caracteres"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-zinc-300 transition-colors"
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-sm font-medium text-zinc-300">Confirmar Nova Senha</label>
            <input
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              minLength={8}
              disabled={!token || loading}
              className="w-full px-4 py-3 bg-black/50 border border-white/5 rounded-xl focus:ring-2 focus:ring-emerald-500/50 focus:border-emerald-500 transition-all outline-none text-white placeholder:text-zinc-600 disabled:opacity-50"
              placeholder="Repita a nova senha"
            />
          </div>

          <div className="p-3 bg-white/5 rounded-xl text-[11px] text-zinc-400 space-y-1">
            <div className={newPassword.length >= 8 ? 'text-emerald-400' : ''}>
              • Mínimo de 8 caracteres
            </div>
            <div className={newPassword && newPassword === confirmPassword ? 'text-emerald-400' : ''}>
              • Senhas digitadas devem ser idênticas
            </div>
          </div>

          <button
            type="submit"
            disabled={loading || !token}
            className="w-full py-3.5 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium shadow-lg shadow-emerald-500/20 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center gap-2 mt-4"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Salvar Nova Senha'}
          </button>

          <div className="pt-2 text-center">
            <Link
              href="/login"
              className="inline-flex items-center gap-2 text-xs text-zinc-400 hover:text-white transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              Cancelar e voltar ao Login
            </Link>
          </div>
        </form>
      )}

      <div className="mt-8 text-center text-xs text-zinc-500">
        Hospital Logistics Security • O token de uso único é invalidado após a confirmação.
      </div>
    </div>
  );
}

export default function RedefinirSenhaPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 text-slate-100 p-4 selection:bg-emerald-500/30">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-emerald-900/20 via-zinc-950 to-zinc-950"></div>
      <Suspense fallback={<div className="text-white text-sm flex items-center gap-2"><Loader2 className="w-5 h-5 animate-spin text-emerald-400" /> Carregando...</div>}>
        <RedefinirSenhaForm />
      </Suspense>
    </div>
  );
}
