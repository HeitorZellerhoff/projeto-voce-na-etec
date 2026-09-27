import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { FarmaciaDashboardClient } from '@/components/farmacia/FarmaciaDashboardClient';

export default async function FarmaciaDashboard() {
  const session = await getSession();
  if (!session) redirect('/login');

  const farmSector = await prisma.sector.findUnique({
    where: { code: 'FARMACIA' },
  });

  if (!farmSector) {
    return <div className="text-red-400 p-8">Setor Farmácia Central não configurado no banco.</div>;
  }

  const [stocks, recentMovements, products, batches, outgoingRequests, incomingRequests, sectors] = await Promise.all([
    prisma.stock.findMany({
      where: { sectorId: farmSector.id },
      include: {
        product: { include: { category: true } },
        batch: true,
      },
      orderBy: { product: { name: 'asc' } },
    }),
    prisma.stockMovement.findMany({
      where: { sectorId: farmSector.id },
      take: 6,
      orderBy: { createdAt: 'desc' },
      include: {
        product: true,
        batch: true,
      },
    }),
    prisma.product.findMany({
      where: { status: 'ATIVO' },
      orderBy: { name: 'asc' },
    }),
    prisma.productBatch.findMany({
      orderBy: { expirationDate: 'asc' },
    }),
    prisma.sectorRequest.findMany({
      where: { requestingSectorId: farmSector.id },
      include: {
        requestingSector: true,
        supplyingSector: true,
        requestedBy: true,
        attendedBy: true,
        items: { include: { product: true, batch: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.sectorRequest.findMany({
      where: { supplyingSectorId: farmSector.id },
      include: {
        requestingSector: true,
        supplyingSector: true,
        requestedBy: true,
        attendedBy: true,
        items: { include: { product: true, batch: true } },
      },
      orderBy: { createdAt: 'desc' },
    }),
    prisma.sector.findMany({
      where: { status: 'ATIVO' },
      orderBy: { name: 'asc' },
    }),
  ]);

  return (
    <FarmaciaDashboardClient
      stocks={stocks as any}
      recentMovements={recentMovements as any}
      products={products as any}
      batches={batches as any}
      outgoingRequests={outgoingRequests as any}
      incomingRequests={incomingRequests as any}
      sectors={sectors as any}
      currentSector={farmSector}
    />
  );
}
