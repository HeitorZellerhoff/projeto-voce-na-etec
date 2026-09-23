'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { ShieldCheck, Loader2 } from 'lucide-react';

export default function FirstAccessPage() {
  const router = useRouter();
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      return setError('As senhas não coincidem');
    }
    if (newPassword.length < 8) {
      return setError('A senha deve ter no mínimo 8 caracteres');
    }

    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/first-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ newPassword })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || data.error || 'Erro ao alterar a senha');
      
      setSuccess(true);
      setTimeout(() => router.push('/dashboard'), 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-zinc-950 p-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-cyan-900/20 via-zinc-950 to-zinc-950"></div>
      
      <div className="w-full max-w-md relative z-10 backdrop-blur-xl bg-zinc-900/50 p-8 rounded-3xl border border-white/10 shadow-2xl overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-cyan-500 to-blue-500"></div>

        <div className="flex flex-col items-center mb-6">
          <div className="p-3 bg-cyan-500/10 rounded-2xl mb-4">
            <ShieldCheck className="w-10 h-10 text-cyan-400" />
          </div>
          <h1 className="text-xl font-bold text-white text-center">Primeiro Acesso</h1>
          <p className="text-sm text-zinc-400 text-center mt-2">Por questões de segurança corporativa, você precisa definir uma senha definitiva.</p>
        </div>

        {error && <div className="mb-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">{error}</div>}
        {success && <div className="mb-4 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-emerald-400 text-sm font-medium flex items-center justify-center gap-2">
            <ShieldCheck className="w-5 h-5" /> Senha cadastrada! Redirecionando...
        </div>}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-sm font-medium text-zinc-300">Nova Senha</label>
            <input 
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="w-full px-4 py-3 mt-1 bg-black/50 border border-white/5 rounded-xl text-white outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all placeholder:text-zinc-600"
              required
              placeholder="Min. 8 caracteres"
            />
          </div>
          <div>
            <label className="text-sm font-medium text-zinc-300">Confirmar Nova Senha</label>
            <input 
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full px-4 py-3 mt-1 bg-black/50 border border-white/5 rounded-xl text-white outline-none focus:border-cyan-500 focus:ring-1 focus:ring-cyan-500 transition-all placeholder:text-zinc-600"
              required
              placeholder="Digite novamente"
            />
          </div>
          <button 
            type="submit" 
            disabled={loading || success}
            className="w-full py-3.5 mt-2 bg-cyan-600 hover:bg-cyan-500 text-white rounded-xl font-medium flex justify-center items-center gap-2 transition-all disabled:opacity-50"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Salvar Senha Segura'}
          </button>
        </form>
      </div>
    </div>
  );
}
