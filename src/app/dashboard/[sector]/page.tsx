import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { SectorDashboardClient } from '@/components/sector/SectorDashboardClient';

interface PageProps {
  params: Promise<{ sector: string }>;
}

export default async function GenericSectorDashboard({ params }: PageProps) {
  const session = await getSession();
  if (!session) redirect('/login');

  const resolvedParams = await params;
  const sectorSlug = resolvedParams.sector?.toLowerCase();

  // Buscar usuário e seu setor autenticado
  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    include: { role: true, sector: true },
  });

  if (!user) redirect('/login');

  // Buscar o setor solicitado no banco de dados
  const allSectors = await prisma.sector.findMany({
    where: { status: 'ATIVO' },
    orderBy: { name: 'asc' }
  });

  const targetSector = allSectors.find(
    s => s.code.toLowerCase() === sectorSlug || s.name.toLowerCase() === sectorSlug
  );

  if (!targetSector) {
    return (
      <div className="p-8 bg-zinc-900/60 rounded-2xl border border-white/5 text-zinc-300">
        <h2 className="text-xl font-bold text-white mb-2">Setor Hospitalar Não Encontrado</h2>
        <p className="text-sm text-zinc-400">
          O setor &quot;{sectorSlug}&quot; não está cadastrado ou não se encontra ativo no sistema hospitalar.
        </p>
      </div>
    );
  }

  // Regra de Isolamento e Segurança (Backend Verification):
  // O usuário comum pode visualizar APENAS o seu próprio setor.
  // Apenas o Administrador possui visão transversal.
  const isAdmin = user.role.name === 'ADMINISTRADOR';
  const isOwnSector = user.sectorId === targetSector.id;

  if (!isAdmin && !isOwnSector) {
    redirect('/403-acesso-negado');
  }

  // Buscar dados específicos e isolados deste setor
  const [stocks, outgoingRequests, incomingRequests, products] = await Promise.all([
    prisma.stock.findMany({
      where: { sectorId: targetSector.id },
      include: {
        product: {
          include: { category: true }
        },
        batch: true,
      },
      orderBy: { product: { name: 'asc' } },
    }),
    prisma.sectorRequest.findMany({
      where: { requestingSectorId: targetSector.id },
      include: {
        requestingSector: true,
        supplyingSector: true,
        requestedBy: true,
        attendedBy: true,
        items: {
          include: { product: true, batch: true }
        }
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.sectorRequest.findMany({
      where: { supplyingSectorId: targetSector.id },
      include: {
        requestingSector: true,
        supplyingSector: true,
        requestedBy: true,
        attendedBy: true,
        items: {
          include: { product: true, batch: true }
        }
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.product.findMany({
      where: { status: 'ATIVO' },
      orderBy: { name: 'asc' },
    }),
  ]);

  return (
    <SectorDashboardClient
      currentSector={targetSector}
      stocks={stocks as any}
      availableSectors={allSectors}
      availableProducts={products}
      outgoingRequests={outgoingRequests as any}
      incomingRequests={incomingRequests as any}
    />
  );
}
