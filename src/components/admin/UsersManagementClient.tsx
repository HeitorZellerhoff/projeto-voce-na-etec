'use client';

import { useState } from 'react';
import { User, Sector, Role } from '@/generated/prisma';
import { Search, Plus, ShieldBan, ShieldCheck, UserCog } from 'lucide-react';
import { ConfirmActionModal } from '@/components/shared/ConfirmActionModal';
import { CreateUserModal } from './CreateUserModal';

type UserWithRelations = User & { sector: Sector; role: Role };

interface Props {
  initialUsers: UserWithRelations[];
  sectors: Sector[];
  roles: Role[];
}

export function UsersManagementClient({ initialUsers, sectors, roles }: Props) {
  const [users, setUsers] = useState(initialUsers);
  const [searchTerm, setSearchTerm] = useState('');
  const [sectorFilter, setSectorFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');

  // Modals state
  const [userToToggle, setUserToToggle] = useState<{ user: UserWithRelations; action: 'BLOCK' | 'UNBLOCK' } | null>(null);
  const [isRegisterModalOpen, setIsRegisterModalOpen] = useState(false);

  // Filtros aplicados localmente
  const filteredUsers = users.filter(u => {
    const matchSearch = u.name.toLowerCase().includes(searchTerm.toLowerCase()) || u.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchSector = sectorFilter ? u.sectorId === sectorFilter : true;
    const matchStatus = statusFilter ? u.status === statusFilter : true;
    return matchSearch && matchSector && matchStatus;
  });

  const handleToggleUserStatus = async () => {
    if (!userToToggle) return;
    try {
      const res = await fetch(`/api/admin/users/${userToToggle.user.id}/block`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: userToToggle.action }),
      });
      if (!res.ok) throw new Error('Falha ao alterar status do usuário');
      
      const newStatus = userToToggle.action === 'UNBLOCK' ? 'ATIVO' : 'BLOQUEADO';
      setUsers(users.map(u => u.id === userToToggle.user.id ? { ...u, status: newStatus } : u));
    } catch (err) {
      console.error(err);
      alert('Erro ao atualizar status do colaborador.');
    } finally {
      setUserToToggle(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row gap-4 justify-between">
        <div className="flex gap-4 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-zinc-500" />
            <input 
              type="text"
              placeholder="Buscar por nome ou e-mail..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-black/50 border border-white/5 rounded-xl text-white outline-none focus:border-emerald-500 text-sm"
            />
          </div>
          <select 
            value={sectorFilter}
            onChange={(e) => setSectorFilter(e.target.value)}
            className="px-4 py-2 bg-black/50 border border-white/5 rounded-xl text-zinc-300 text-sm outline-none"
          >
            <option value="">Todos os Setores</option>
            {sectors.map(s => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
          <select 
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-4 py-2 bg-black/50 border border-white/5 rounded-xl text-zinc-300 text-sm outline-none"
          >
            <option value="">Status</option>
            <option value="ATIVO">Ativo</option>
            <option value="BLOQUEADO">Bloqueado</option>
            <option value="PENDENTE">Pendente</option>
          </select>
        </div>
        
        <button 
          onClick={() => setIsRegisterModalOpen(true)}
          className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white rounded-xl font-medium text-sm flex items-center gap-2 shadow-lg shadow-emerald-500/20"
        >
          <Plus className="w-4 h-4" />
          Registrar Colaborador
        </button>
      </div>

      <div className="bg-zinc-900/50 border border-white/5 rounded-2xl overflow-hidden backdrop-blur-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-zinc-400">
            <thead className="bg-black/20 text-xs uppercase text-zinc-500 border-b border-white/5">
              <tr>
                <th className="px-6 py-4 font-medium">Colaborador</th>
                <th className="px-6 py-4 font-medium">Cargo (Role)</th>
                <th className="px-6 py-4 font-medium">Setor de Atuação</th>
                <th className="px-6 py-4 font-medium">Status</th>
                <th className="px-6 py-4 text-right font-medium">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {filteredUsers.map(user => (
                <tr key={user.id} className="hover:bg-white/5 transition-colors">
                  <td className="px-6 py-4">
                    <div className="text-white font-medium">{user.name}</div>
                    <div className="text-xs text-zinc-500">{user.email} • Mat: {user.registration}</div>
                  </td>
                  <td className="px-6 py-4">{user.role.name}</td>
                  <td className="px-6 py-4">{user.sector.name}</td>
                  <td className="px-6 py-4">
                    {user.status === 'ATIVO' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                        <ShieldCheck className="w-3 h-3" /> Ativo
                      </span>
                    ) : user.status === 'BLOQUEADO' ? (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
                        <ShieldBan className="w-3 h-3" /> Bloqueado
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20">
                        <UserCog className="w-3 h-3" /> Pendente
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {user.status === 'BLOQUEADO' ? (
                      <button 
                        onClick={() => setUserToToggle({ user, action: 'UNBLOCK' })}
                        className="text-emerald-400 hover:text-emerald-300 font-medium text-xs transition-colors"
                      >
                        Reativar / Desbloquear
                      </button>
                    ) : (
                      <button 
                        onClick={() => setUserToToggle({ user, action: 'BLOCK' })}
                        className="text-red-400 hover:text-red-300 font-medium text-xs transition-colors"
                      >
                        Bloquear Acesso
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <CreateUserModal
        isOpen={isRegisterModalOpen}
        onClose={() => setIsRegisterModalOpen(false)}
        sectors={sectors}
        roles={roles}
        onSuccess={(newUser) => setUsers([newUser, ...users])}
      />

      <ConfirmActionModal 
        isOpen={!!userToToggle}
        onClose={() => setUserToToggle(null)}
        onConfirm={handleToggleUserStatus}
        title={userToToggle?.action === 'UNBLOCK' ? "Reativar Acesso do Colaborador" : "Revogar Acesso do Colaborador"}
        description={
          userToToggle?.action === 'UNBLOCK' ? (
            <>Você está prestes a reativar o acesso de <strong>{userToToggle?.user.name}</strong> ao Sistema Hospitalar.</>
          ) : (
            <>Você está prestes a bloquear o acesso de <strong>{userToToggle?.user.name}</strong> ao Sistema Hospitalar. A sessão do usuário será imediatamente revogada.</>
          )
        }
        confirmText={userToToggle?.action === 'UNBLOCK' ? "Reativar Acesso" : "Bloquear Acesso (Imediato)"}
        isDestructive={userToToggle?.action === 'BLOCK'}
      />
    </div>
  );
}
