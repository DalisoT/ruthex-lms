/**
 * Prisma client singleton.
 *
 * In development, Next.js's hot reload creates many module instances, which
 * would each spin up a PrismaClient and exhaust connection pools. We cache
 * the client on `globalThis` to survive reloads.
 */
import { PrismaClient } from '@prisma/client';

declare global {
  // eslint-disable-next-line no-var
  var __ruthexPrisma: PrismaClient | undefined;
}

export const prisma: PrismaClient =
  globalThis.__ruthexPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalThis.__ruthexPrisma = prisma;
}
