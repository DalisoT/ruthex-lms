import { NextRequest, NextResponse } from 'next/server';
import { readJsonBody } from '@/lib/request-body';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { loans, borrowers } from '@/lib/db/schema';
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
  const body = await readJsonBody(req);
  const parsed = schema.safeParse(body ?? {});
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  const loanRows = await db
    .select({
      id: loans.id,
      loanNo: loans.loanNo,
      status: loans.status,
      principalZMW: loans.principalZMW,
      borrowerId: loans.borrowerId,
      borrowerFirstName: borrowers.firstName,
      borrowerLastName: borrowers.lastName,
      borrowerPhone: borrowers.phone,
      borrowerNrcNumber: borrowers.nrcNumber,
    })
    .from(loans)
    .innerJoin(borrowers, eq(loans.borrowerId, borrowers.id))
    .where(eq(loans.id, params.id))
    .limit(1);
  const loan = loanRows[0];
  if (!loan) return NextResponse.json({ error: 'Loan not found' }, { status: 404 });
  if (loan.status !== 'PENDING_DISBURSEMENT') {
    return NextResponse.json({ error: `Loan is in status ${loan.status} — cannot disburse` }, { status: 400 });
  }

  let mmRef: string | null = null;
  if (parsed.data.channel === 'MOBILE_MONEY') {
    const msisdn = parsed.data.msisdn ? normalizeMsisdn(parsed.data.msisdn) : normalizeMsisdn(loan.borrowerPhone);
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

  await db.update(loans).set({
    status: 'ACTIVE',
    disbursedAt: new Date(),
    disbursementChannel: parsed.data.channel,
    disbursementRef: mmRef,
    firstPaymentDue: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
  }).where(eq(loans.id, loan.id));

  if (parsed.data.channel === 'CASH' && loan.principalZMW / 27 >= 10_000) {
    await openCtr({
      borrowerId: loan.borrowerId,
      loanId: loan.id,
      description: `Cash loan disbursement of K${loan.principalZMW} (USD ${(loan.principalZMW / 27).toFixed(0)})`,
      evidence: { loanNo: loan.loanNo, principalZMW: loan.principalZMW },
      amountZMW: loan.principalZMW,
      transactionDate: new Date(),
      transactionType: 'WITHDRAWAL',
      customerName: `${loan.borrowerFirstName} ${loan.borrowerLastName}`,
      customerNrc: loan.borrowerNrcNumber,
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
