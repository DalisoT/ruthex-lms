import { NextRequest, NextResponse } from 'next/server';
import { eq, sql } from 'drizzle-orm';
import { db } from '@/lib/db';
import { loans } from '@/lib/db/schema';
import { getSessionFromRequest, AuthorizationError, requireSession } from '@/lib/auth';
import { audit } from '@/lib/audit';

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  let session: Awaited<ReturnType<typeof getSessionFromRequest>>;
  try {
    session = await getSessionFromRequest(req);
    requireSession(session, ['ADMIN', 'BRANCH_MANAGER', 'CREDIT_OFFICER']);
  } catch (e) {
    if (e instanceof AuthorizationError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const rows = await db.select().from(loans).where(eq(loans.id, params.id)).limit(1);
  const loan = rows[0];
  if (!loan) return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
  if (loan.status === 'CLOSED' || loan.status === 'WRITTEN_OFF') {
    return NextResponse.json({ error: 'Cannot restructure a closed or written-off loan' }, { status: 400 });
  }
  await db.update(loans).set({
    status: 'RESTRUCTURED',
    restructureCount: sql`${loans.restructureCount} + 1`,
    daysInArrears: 0,
  }).where(eq(loans.id, loan.id));
  await audit({
    userId: session!.userId,
    action: 'LOAN_RESTRUCTURED',
    entity: 'LOAN',
    entityId: loan.id,
    meta: { loanNo: loan.loanNo },
  });
  return NextResponse.json({ ok: true });
}
