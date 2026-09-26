/**
 * Drizzle client for RUTHEX LMS.
 *
 * Uses Neon's serverless HTTP driver — no TCP connection required, which is
 * what makes this run on Cloudflare Workers V8 isolates. The standard pg
 * driver would fail because Workers can't open raw TCP sockets (without
 * Hyperdrive, which requires a paid plan).
 *
 * In dev/local, DATABASE_URL points at Neon the same way; the Neon HTTP
 * driver works against any Postgres via Neon's pooler or direct endpoint.
 */
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './schema';

declare global {
  // eslint-disable-next-line no-var
  var __ruthexDb: ReturnType<typeof drizzle> | undefined;
}

function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set. Set it in .env (local) or via `wrangler secret put DATABASE_URL` (Cloudflare).');
  }
  const sqlClient = neon(url);
  return drizzle(sqlClient, { schema });
}

export const db = globalThis.__ruthexDb ?? createDb();

if (process.env.NODE_ENV !== 'production') {
  globalThis.__ruthexDb = db;
}

export * as tables from './schema';
export { schema };
