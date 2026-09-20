import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { getSessionFromRequest, AuthorizationError, requireSession } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { getMobileMoneyAdapter, normalizeMsisdn } from '@/lib/mobile-money';
import { openCtr } from '@/lib/aml';
import { z } from 'zod';

const schema = z.object({
  channel: z.enum(['CASH', 'MOBILE_MONEY', 'BANK_TRANSFER']).default('CASH'),
  msisdn: z.string().nullable().optional(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  let session: Awaited<ReturnType<typeof getSessionFromRequest>>;
  try {
    session = await getSessionFromRequest(req);
    requireSession(session, ['ADMIN', 'BRANCH_MANAGER', 'CASHIER', 'CREDIT_OFFICER']);
  } catch (e) {
    if (e instanceof AuthorizationError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  let body: unknown = {};
  try { body = await req.json(); } catch { /* allow empty body */ }
  const parsed = schema.safeParse(body ?? {});
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  const loan = await prisma.loan.findUnique({ where: { id: params.id }, include: { borrower: true } });
  if (!loan) return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
  if (loan.status !== 'PENDING_DISBURSEMENT') {
    return NextResponse.json({ error: `Loan is in status ${loan.status} — cannot disburse` }, { status: 400 });
  }

  // If mobile money, initiate disbursement via adapter
  let mmRef: string | null = null;
  if (parsed.data.channel === 'MOBILE_MONEY') {
    const msisdn = parsed.data.msisdn ? normalizeMsisdn(parsed.data.msisdn) : normalizeMsisdn(loan.borrower.phone);
    const adapter = getMobileMoneyAdapter();
    const result = await adapter.requestDisbursement({
      direction: 'OUTBOUND',
      amountZMW: loan.principalZMW,
      msisdn,
      accountRef: loan.loanNo,
      narration: `Loan disbursement for ${loan.loanNo}`,
    });
    mmRef = result.externalId;
  }

  await prisma.loan.update({
    where: { id: loan.id },
    data: {
      status: 'ACTIVE',
      disbursedAt: new Date(),
      disbursementChannel: parsed.data.channel,
      disbursementRef: mmRef,
      firstPaymentDue: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    },
  });

  // CTR trigger for large cash disbursements
  if (parsed.data.channel === 'CASH' && loan.principalZMW / 27 >= 10_000) {
    await openCtr({
      borrowerId: loan.borrowerId,
      loanId: loan.id,
      description: `Cash loan disbursement of K${loan.principalZMW} (USD ${(loan.principalZMW / 27).toFixed(0)})`,
      evidence: { loanNo: loan.loanNo, principalZMW: loan.principalZMW },
      amountZMW: loan.principalZMW,
      transactionDate: new Date(),
      transactionType: 'WITHDRAWAL',
      customerName: `${loan.borrower.firstName} ${loan.borrower.lastName}`,
      customerNrc: loan.borrower.nrcNumber,
    });
  }

  await audit({
    userId: session!.userId,
    action: 'DISBURSE_LOAN',
    entity: 'LOAN',
    entityId: loan.id,
    meta: { loanNo: loan.loanNo, channel: parsed.data.channel, mmRef },
  });

  return NextResponse.json({ ok: true, mmRef });
}
