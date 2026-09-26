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
 *
 * IMPORTANT for Cloudflare Workers: process.env is populated lazily at
 * request time, not at module load time. Calling `neon(url)` at import time
 * would always see an empty URL. The lazy `getDb()` accessor below defers
 * client creation until the first query.
 */
import { drizzle } from 'drizzle-orm/neon-http';
import { neon } from '@neondatabase/serverless';
import * as schema from './schema';
export { prisma } from '../prisma-shim';

let _db: ReturnType<typeof drizzle> | null = null;

export function getDb() {
  if (_db) return _db;
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is not set. Set it in .env (local) or via `wrangler secret put DATABASE_URL` (Cloudflare).');
  }
  const sqlClient = neon(url);
  _db = drizzle(sqlClient, { schema });
  return _db;
}

// Backwards-compatible default export. Some call sites import `db` directly.
// On Workers, this is now a Proxy that defers to `getDb()` so the first
// query's runtime sees a populated process.env.
export const db: ReturnType<typeof drizzle> = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_target, prop) {
    const target = getDb() as unknown as Record<string | symbol, unknown>;
    const value = target[prop];
    return typeof value === 'function' ? (value as (...args: unknown[]) => unknown).bind(target) : value;
  },
}) as ReturnType<typeof drizzle>;

export * as tables from './schema';
export { schema };
