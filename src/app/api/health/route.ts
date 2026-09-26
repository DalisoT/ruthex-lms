import { NextResponse } from 'next/server';
import { sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users, branches, borrowers, loans, repayments, amlAlerts, auditLogs } from '@/lib/db/schema';

/**
 * Health endpoint — used by uptime monitors / load balancers.
 *
 * - GET /api/health  → 200 OK if the database is reachable and the schema is reachable.
 * - GET /api/health?detail=1  → adds counts for diagnostic output.
 */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const detail = url.searchParams.get('detail') === '1';
  const started = Date.now();
  let dbOk = false;
  let dbError: string | null = null;
  let counts: Record<string, number> | null = null;
  try {
    await db.execute(sql`SELECT 1`);
    dbOk = true;
    if (detail) {
      const [u, b, br, l, r, a, al] = await Promise.all([
        db.select({ c: sql<number>`count(*)::int` }).from(users),
        db.select({ c: sql<number>`count(*)::int` }).from(branches),
        db.select({ c: sql<number>`count(*)::int` }).from(borrowers),
        db.select({ c: sql<number>`count(*)::int` }).from(loans),
        db.select({ c: sql<number>`count(*)::int` }).from(repayments),
        db.select({ c: sql<number>`count(*)::int` }).from(amlAlerts),
        db.select({ c: sql<number>`count(*)::int` }).from(auditLogs),
      ]);
      counts = {
        users: u[0]?.c ?? 0,
        branches: b[0]?.c ?? 0,
        borrowers: br[0]?.c ?? 0,
        loans: l[0]?.c ?? 0,
        repayments: r[0]?.c ?? 0,
        amlAlerts: a[0]?.c ?? 0,
        auditEntries: al[0]?.c ?? 0,
      };
    }
  } catch (e) {
    dbError = (e as Error).message;
  }
  const elapsed = Date.now() - started;
  const ok = dbOk;
  const body = {
    status: ok ? 'ok' : 'degraded',
    service: 'ruthex-lms',
    version: process.env.npm_package_version ?? '0.1.0',
    database: dbOk ? 'reachable' : 'unreachable',
    databaseError: dbError,
    latencyMs: elapsed,
    timestamp: new Date().toISOString(),
    counts,
  };
  return NextResponse.json(body, { status: ok ? 200 : 503 });
}
