import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { snapshotBozReport } from '@/lib/boz-reports';
import { getSessionFromRequest, AuthorizationError, requireSession } from '@/lib/auth';
import { audit } from '@/lib/audit';

const schema = z.object({
  reports: z.array(z.object({
    type: z.enum(['CAPITAL_ADEQUACY', 'LIQUIDITY', 'ASSET_QUALITY', 'LARGE_EXPOSURES', 'RELATED_PARTY', 'MONTHLY_PRUDENTIAL']),
    payload: z.record(z.string(), z.any()),
  })),
  periodStart: z.string(),
  periodEnd: z.string(),
});

export async function POST(req: NextRequest) {
  let session: Awaited<ReturnType<typeof getSessionFromRequest>>;
  try {
    session = await getSessionFromRequest(req);
    requireSession(session, ['ADMIN', 'COMPLIANCE_OFFICER', 'AUDITOR']);
  } catch (e) {
    if (e instanceof AuthorizationError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  const periodStart = new Date(parsed.data.periodStart);
  const periodEnd = new Date(parsed.data.periodEnd);

  let count = 0;
  for (const r of parsed.data.reports) {
    await snapshotBozReport(r.type, periodStart, periodEnd, r.payload, session!.userId);
    count += 1;
  }

  await audit({
    userId: session!.userId,
    action: 'BOZ_REPORT_GENERATED',
    entity: 'BOZ_REPORT',
    meta: { count, periodStart, periodEnd },
  });

  return NextResponse.json({ ok: true, count });
}
