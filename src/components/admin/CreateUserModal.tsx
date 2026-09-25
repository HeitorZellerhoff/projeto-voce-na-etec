'use client';

import { useState } from 'react';
import { X, Loader2, UserPlus, KeyRound, ShieldAlert } from 'lucide-react';
import { Sector, Role, User } from '@/generated/prisma';

type UserWithRelations = User & { sector: Sector; role: Role };

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  sectors: Sector[];
  roles: Role[];
  onSuccess: (newUser: UserWithRelations) => void;
}

export function CreateUserModal({
  isOpen,
  onClose,
  sectors,
  roles,
  onSuccess,
}: CreateUserModalProps) {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [registration, setRegistration] = useState('');
  const [password, setPassword] = useState('SenhaSegura123!');
  const [sectorId, setSectorId] = useState(sectors[0]?.id || '');
  const [roleId, setRoleId] = useState(roles[0]?.id || '');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

  const generateRandomPassword = () => {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%';
    let res = '';
    for (let i = 0; i < 12; i++) {
      res += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    setPassword(res);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          registration,
          password,
          sectorId,
          roleId,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Erro ao cadastrar usuário');
      }

      onSuccess(data.user);
      onClose();
    } catch (err: any) {
      setError(err.message || 'Erro inesperado ao cadastrar usuário');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4 animate-in fade-in">
      <div className="bg-zinc-900 border border-white/10 rounded-2xl p-6 w-full max-w-lg shadow-2xl relative animate-in zoom-in-95">
        <button
          onClick={onClose}
          disabled={isLoading}
          className="absolute top-4 right-4 text-zinc-500 hover:text-white transition-colors disabled:opacity-50"
        >
          <X className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-3 mb-6">
          <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl">
            <UserPlus className="w-6 h-6" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-white tracking-tight">Registrar Novo Colaborador</h2>
            <p className="text-xs text-zinc-400 mt-0.5">Criação de identidade com primeiro acesso protegido</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-xs flex items-center gap-2">
            <ShieldAlert className="w-4 h-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-zinc-400 mb-1">Nome Completo</label>
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Ex: Dra. Mariana Albuquerque"
              className="w-full px-3.5 py-2.5 bg-black/50 border border-white/10 rounded-xl text-white text-sm outline-none focus:border-emerald-500 transition-colors"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">E-mail Corporativo</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="mariana@hospital.com"
                className="w-full px-3.5 py-2.5 bg-black/50 border border-white/10 rounded-xl text-white text-sm outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Matrícula Funcional</label>
              <input
                type="text"
                required
                value={registration}
                onChange={(e) => setRegistration(e.target.value)}
                placeholder="Ex: FAR-1042"
                className="w-full px-3.5 py-2.5 bg-black/50 border border-white/10 rounded-xl text-white text-sm outline-none focus:border-emerald-500 transition-colors"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Setor de Atuação</label>
              <select
                value={sectorId}
                onChange={(e) => setSectorId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-black/50 border border-white/10 rounded-xl text-white text-sm outline-none focus:border-emerald-500 transition-colors"
              >
                {sectors.map((s) => (
                  <option key={s.id} value={s.id} className="bg-zinc-900">
                    {s.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-zinc-400 mb-1">Cargo (Papel RBAC)</label>
              <select
                value={roleId}
                onChange={(e) => setRoleId(e.target.value)}
                className="w-full px-3.5 py-2.5 bg-black/50 border border-white/10 rounded-xl text-white text-sm outline-none focus:border-emerald-500 transition-colors"
              >
                {roles.map((r) => (
                  <option key={r.id} value={r.id} className="bg-zinc-900">
                    {r.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-xs font-medium text-zinc-400">Senha Provisória</label>
              <button
                type="button"
                onClick={generateRandomPassword}
                className="text-[11px] text-emerald-400 hover:text-emerald-300 flex items-center gap-1 transition-colors"
              >
                <KeyRound className="w-3 h-3" /> Gerar Aleatória
              </button>
            </div>
            <input
              type="text"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-3.5 py-2.5 bg-black/50 border border-white/10 rounded-xl text-white font-mono text-sm outline-none focus:border-emerald-500 transition-colors"
            />
            <p className="text-[11px] text-zinc-500 mt-1">
              O usuário será obrigado a trocar esta senha no primeiro login.
            </p>
          </div>

          <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/5">
            <button
              type="button"
              onClick={onClose}
              disabled={isLoading}
              className="px-4 py-2 text-sm font-medium text-zinc-400 hover:text-white bg-white/5 hover:bg-white/10 rounded-xl transition-colors disabled:opacity-50"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isLoading}
              className="px-5 py-2 text-sm font-semibold text-white bg-emerald-600 hover:bg-emerald-500 rounded-xl transition-all shadow-lg shadow-emerald-500/20 disabled:opacity-50 flex items-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Cadastrando...
                </>
              ) : (
                'Criar Colaborador'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
