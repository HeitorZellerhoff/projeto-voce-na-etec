import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { UsersManagementClient } from '@/components/admin/UsersManagementClient';

export default async function AdminUsuariosPage() {
  const session = await getSession();
  if (!session) redirect('/login');

  const admin = await prisma.user.findUnique({
    where: { id: session.sub },
    include: { role: true }
  });

  if (admin?.role.name !== 'ADMINISTRADOR') {
    redirect('/403-acesso-negado');
  }

  // Fetch all sectors and roles for the registration modal
  const sectors = await prisma.sector.findMany({ where: { status: 'ATIVO' } });
  const roles = await prisma.role.findMany();

  // Fetch initial users
  const initialUsers = await prisma.user.findMany({
    include: { sector: true, role: true },
    orderBy: { createdAt: 'desc' }
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-white tracking-tight">Gestão de Identidades (IAM)</h1>
        <p className="text-sm text-zinc-400">Administração Central de Acessos</p>
      </div>

      <UsersManagementClient 
        initialUsers={initialUsers}
        sectors={sectors}
        roles={roles}
      />
    </div>
  );
}
