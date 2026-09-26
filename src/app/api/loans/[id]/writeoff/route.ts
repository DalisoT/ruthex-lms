import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
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
  await db.update(loans).set({
    status: 'WRITTEN_OFF',
    eclProvisionZMW: loan.totalOutstandingZMW,
    principalOutstandingZMW: 0,
    interestOutstandingZMW: 0,
    feesOutstandingZMW: 0,
    totalOutstandingZMW: 0,
    ifrs9Stage: 3,
  }).where(eq(loans.id, loan.id));
  await audit({
    userId: session!.userId,
    action: 'LOAN_WRITTEN_OFF',
    entity: 'LOAN',
    entityId: loan.id,
    meta: { loanNo: loan.loanNo, amount: loan.totalOutstandingZMW },
  });
  return NextResponse.json({ ok: true });
}
