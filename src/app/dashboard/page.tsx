import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth/session';
import { prisma } from '@/lib/prisma';

export default async function DashboardRoot() {
  const session = await getSession();
  if (!session) redirect('/login');
  
  const sector = await prisma.sector.findUnique({ where: { id: session.sectorId } });
  if (sector) {
    redirect(`/dashboard/${sector.code.toLowerCase()}`);
  }
  
  redirect('/login');
}
