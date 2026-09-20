import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

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
    await prisma.$queryRaw`SELECT 1`;
    dbOk = true;
    if (detail) {
      counts = {
        users: await prisma.user.count(),
        branches: await prisma.branch.count(),
        borrowers: await prisma.borrower.count(),
        loans: await prisma.loan.count(),
        repayments: await prisma.repayment.count(),
        amlAlerts: await prisma.amlAlert.count(),
        auditEntries: await prisma.auditLog.count(),
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
