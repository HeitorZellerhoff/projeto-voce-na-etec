import { neonConfig } from '@neondatabase/serverless';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '../generated/prisma';
import ws from 'ws';

// Configura o WebSocket para o driver do Neon em ambientes Node.js/Vercel Edge
neonConfig.webSocketConstructor = ws;

const connectionString = process.env.DATABASE_URL || '';

const prismaClientSingleton = () => {
  if (!connectionString) {
    console.warn("Atenção: DATABASE_URL não definida. Instanciando PrismaClient sem o adapter Neon.");
    return new PrismaClient();
  }

  const adapter = new PrismaNeon({ connectionString });
  
  return new PrismaClient({ adapter });
};

type PrismaClientSingleton = ReturnType<typeof prismaClientSingleton>;

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClientSingleton | undefined;
};

export const db = globalForPrisma.prisma ?? prismaClientSingleton();

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = db;
}
