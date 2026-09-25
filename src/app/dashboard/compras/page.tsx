import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';
import { redirect } from 'next/navigation';
import { ComprasDashboardClient } from '@/components/compras/ComprasDashboardClient';

export default async function ComprasDashboard() {
  const session = await getSession();
  if (!session) redirect('/login');

  const [purchases, suppliers, products] = await Promise.all([
    prisma.purchase.findMany({
      orderBy: { createdAt: 'desc' },
      include: {
        supplier: true,
        requestedBy: { select: { name: true, email: true } },
        approvedBy: { select: { name: true, email: true } },
        items: {
          include: {
            product: true,
          }
        }
      }
    }),
    prisma.supplier.findMany({
      where: { status: 'ATIVO' },
      orderBy: { name: 'asc' },
    }),
    prisma.product.findMany({
      where: { status: 'ATIVO' },
      orderBy: { name: 'asc' },
    })
  ]);

  return (
    <ComprasDashboardClient
      purchases={purchases as any}
      suppliers={suppliers}
      products={products}
      currentUserId={session.sub}
    />
  );
}
