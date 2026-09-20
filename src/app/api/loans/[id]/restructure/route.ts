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
  if (loan.status === 'CLOSED' || loan.status === 'WRITTEN_OFF') {
    return NextResponse.json({ error: 'Cannot restructure a closed or written-off loan' }, { status: 400 });
  }
  await prisma.loan.update({
    where: { id: loan.id },
    data: {
      status: 'RESTRUCTURED',
      restructureCount: { increment: 1 },
      daysInArrears: 0, // restructuring resets days-in-arrears counter
    },
  });
  await audit({
    userId: session!.userId,
    action: 'LOAN_RESTRUCTURED',
    entity: 'LOAN',
    entityId: loan.id,
    meta: { loanNo: loan.loanNo },
  });
  return NextResponse.json({ ok: true });
}
