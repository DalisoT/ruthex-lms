import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
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
  const loan = await prisma.loan.findUnique({ where: { id: params.id } });
  if (!loan) return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
  await prisma.loan.update({
    where: { id: loan.id },
    data: {
      status: 'WRITTEN_OFF',
      // Recognize the provision already taken
      eclProvisionZMW: loan.totalOutstandingZMW,
      principalOutstandingZMW: 0,
      interestOutstandingZMW: 0,
      feesOutstandingZMW: 0,
      totalOutstandingZMW: 0,
      ifrs9Stage: 3,
    },
  });
  await audit({
    userId: session!.userId,
    action: 'LOAN_WRITTEN_OFF',
    entity: 'LOAN',
    entityId: loan.id,
    meta: { loanNo: loan.loanNo, amount: loan.totalOutstandingZMW },
  });
  return NextResponse.json({ ok: true });
}
