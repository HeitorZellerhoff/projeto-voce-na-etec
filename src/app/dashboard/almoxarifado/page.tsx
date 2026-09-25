import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { AlmoxarifadoDashboardClient } from '@/components/almoxarifado/AlmoxarifadoDashboardClient';

export default async function AlmoxarifadoDashboard() {
  const session = await getSession();
  if (!session) redirect('/login');

  const almoxSector = await prisma.sector.findUnique({
    where: { code: 'ALMOXARIFADO' },
  });

  if (!almoxSector) {
    return <div className="text-red-400 p-8">Setor Almoxarifado Geral não configurado no banco.</div>;
  }

  const [stocks, recentMovements, products, batches, sectors] = await Promise.all([
    prisma.stock.findMany({
      where: { sectorId: almoxSector.id },
      include: {
        product: true,
        batch: true,
      },
      orderBy: { product: { name: 'asc' } },
    }),
    prisma.stockMovement.findMany({
      where: { sectorId: almoxSector.id },
      take: 6,
      orderBy: { createdAt: 'desc' },
      include: {
        product: true,
        batch: true,
        sector: true,
      },
    }),
    prisma.product.findMany({
      where: { status: 'ATIVO' },
      orderBy: { name: 'asc' },
    }),
    prisma.productBatch.findMany({
      orderBy: { expirationDate: 'asc' },
    }),
    prisma.sector.findMany({
      where: { status: 'ATIVO' },
      orderBy: { name: 'asc' },
    }),
  ]);

  return (
    <AlmoxarifadoDashboardClient
      stocks={stocks as any}
      recentMovements={recentMovements as any}
      products={products as any}
      batches={batches as any}
      sectors={sectors as any}
      almoxSectorId={almoxSector.id}
    />
  );
}
