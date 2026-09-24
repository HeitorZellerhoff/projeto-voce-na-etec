import { neonConfig } from '@neondatabase/serverless';
import { PrismaNeon } from '@prisma/adapter-neon';
import ws from 'ws';
import { PrismaClient } from '../generated/prisma';

neonConfig.webSocketConstructor = ws;

const prismaClientSingleton = () => {
  const connectionString = `${process.env.DATABASE_URL}`;
  
  // Se for um banco local (como no GitHub Actions), usa o Prisma puro sem o Adapter do Neon
  if (connectionString.includes('localhost') || connectionString.includes('127.0.0.1') || process.env.CI) {
    return new PrismaClient();
  }

  const adapter = new PrismaNeon({ connectionString });
  return new PrismaClient({ adapter });
};

type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientSingleton | undefined;
};

export const prisma = globalForPrisma.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}
