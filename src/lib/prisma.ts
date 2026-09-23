import { neonConfig, Pool } from '@neondatabase/serverless';
import { PrismaNeon } from '@prisma/adapter-neon';
import { PrismaClient } from '../generated/prisma';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

const connectionString = process.env.DATABASE_URL || '';

const prismaClientSingleton = () => {
  if (!connectionString) {
    console.warn("Atenção: DATABASE_URL não definida. Instanciando PrismaClient estático com Mock Pool para Build.");
    const dummyPool = new Pool({ connectionString: 'postgresql://dummy:dummy@ep-dummy-pooler.us-east-1.aws.neon.tech/neondb?sslmode=require' });
    const dummyAdapter = new PrismaNeon(dummyPool as any);
    return new PrismaClient({ adapter: dummyAdapter });
  }

  const pool = new Pool({ connectionString });
  const adapter = new PrismaNeon(pool as any);
  
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
