import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __sfuPrisma: PrismaClient | undefined;
}

export const prisma = global.__sfuPrisma ?? new PrismaClient({ log: ['warn', 'error'] });
if (process.env.NODE_ENV !== 'production') global.__sfuPrisma = prisma;
