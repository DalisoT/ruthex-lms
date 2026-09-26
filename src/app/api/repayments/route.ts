import { NextRequest, NextResponse } from 'next/server';
import { readJsonBody } from '@/lib/request-body';
import { z } from 'zod';
import { sql, eq, asc, and, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { loans, repayments, repaymentSchedule, borrowers } from '@/lib/db/schema';
import { getSessionFromRequest, AuthorizationError, requireSession } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { evaluateTransactionForCtr, getSameDayCashTotalZMW, openCtr, openStr } from '@/lib/aml';
import { runAllDetectors } from '@/lib/aml-engine';
import { getMobileMoneyAdapter, normalizeMsisdn } from '@/lib/mobile-money';
import { nextReceiptNo } from '@/lib/utils';

const schema = z.object({
  loanId: z.string().min(1),
  totalPaidZMW: z.number().min(0.01),
  paymentMethod: z.enum(['CASH', 'MOBILE_MONEY', 'BANK_TRANSFER', 'CHEQUE', 'OFFSET']),
  paymentChannel: z.string().nullable().optional(),
  msisdn: z.string().nullable().optional(),
  paidByName: z.string().nullable().optional(),
  paidByRelation: z.string().nullable().optional(),
  notes: z.string().nullable().optional(),
});

export async function POST(req: NextRequest) {
  let session: Awaited<ReturnType<typeof getSessionFromRequest>>;
  try {
    session = await getSessionFromRequest(req);
    requireSession(session, ['ADMIN', 'BRANCH_MANAGER', 'CASHIER', 'CREDIT_OFFICER', 'LOAN_OFFICER']);
  } catch (e) {
    if (e instanceof AuthorizationError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const body = await readJsonBody(req);
  if (body === null) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  const loanRows = await db
    .select({
      id: loans.id,
      loanNo: loans.loanNo,
      status: loans.status,
      principalOutstandingZMW: loans.principalOutstandingZMW,
      interestOutstandingZMW: loans.interestOutstandingZMW,
      feesOutstandingZMW: loans.feesOutstandingZMW,
      totalOutstandingZMW: loans.totalOutstandingZMW,
      daysInArrears: loans.daysInArrears,
      disbursedAt: loans.disbursedAt,
      borrowerId: loans.borrowerId,
      borrowerFirstName: borrowers.firstName,
      borrowerLastName: borrowers.lastName,
      borrowerPhone: borrowers.phone,
      borrowerNrcNumber: borrowers.nrcNumber,
    })
    .from(loans)
    .innerJoin(borrowers, eq(loans.borrowerId, borrowers.id))
    .where(eq(loans.id, parsed.data.loanId))
    .limit(1);
  const loan = loanRows[0];
  if (!loan) return NextResponse.json({ error: 'Loan not found' }, { status: 404 });

  const totalPaid = parsed.data.totalPaidZMW;
  let principalPaid = Math.min(loan.principalOutstandingZMW, totalPaid);
  let interestPaid = Math.min(loan.interestOutstandingZMW, Math.max(0, totalPaid - principalPaid));
  let feesPaid = Math.max(0, totalPaid - principalPaid - interestPaid);

  const oldestRows = await db
    .select()
    .from(repaymentSchedule)
    .where(and(
      eq(repaymentSchedule.loanId, loan.id),
      inArray(repaymentSchedule.status, ['PENDING', 'PARTIAL', 'OVERDUE']),
    ))
    .orderBy(asc(repaymentSchedule.dueDate))
    .limit(1);
  const oldestDueInstallment = oldestRows[0];

  const countRows = await db.select({ c: sql<number>`count(*)::int` }).from(repayments);
  const receiptNo = nextReceiptNo((countRows[0]?.c ?? 0) + 1);

  let mmTxnId: string | null = null;
  if (parsed.data.paymentMethod === 'MOBILE_MONEY' && parsed.data.msisdn && parsed.data.paymentChannel) {
    const adapter = getMobileMoneyAdapter();
    const msisdn = normalizeMsisdn(parsed.data.msisdn);
    const result = await adapter.requestCollection({
      direction: 'INBOUND',
      amountZMW: totalPaid,
      msisdn,
      accountRef: loan.loanNo,
      narration: `Loan repayment for ${loan.loanNo}`,
    });
    mmTxnId = result.externalId;
  }

  const [repayment] = await db.insert(repayments).values({
    receiptNo,
    loanId: loan.id,
    installmentId: oldestDueInstallment?.id ?? null,
    recordedById: session!.userId,
    principalPaidZMW: principalPaid,
    interestPaidZMW: interestPaid,
    feesPaidZMW: feesPaid,
    totalPaidZMW: totalPaid,
    paymentMethod: parsed.data.paymentMethod,
    paymentChannel: parsed.data.paymentChannel ?? null,
    externalRef: mmTxnId,
    paidByName: parsed.data.paidByName ?? null,
    paidByRelation: parsed.data.paidByRelation ?? null,
    notes: parsed.data.notes ?? null,
  }).returning();

  const newPrincipal = Math.max(0, loan.principalOutstandingZMW - principalPaid);
  const newInterest = Math.max(0, loan.interestOutstandingZMW - interestPaid);
  const newFees = Math.max(0, loan.feesOutstandingZMW - feesPaid);
  const newOutstanding = newPrincipal + newInterest + newFees;
  let newStatus = loan.status;
  if (loan.status === 'PENDING_DISBURSEMENT' && loan.disbursedAt) newStatus = 'ACTIVE';
  if (newOutstanding <= 0.01) newStatus = 'CLOSED';
  if (loan.daysInArrears > 0 && newPrincipal > 0) {
    if (newStatus === 'ACTIVE') newStatus = 'IN_ARREARS';
  } else if (loan.daysInArrears === 0 && newStatus === 'IN_ARREARS') {
    newStatus = 'ACTIVE';
  }
  const newStage = loan.daysInArrears > 90 ? 3 : loan.daysInArrears > 30 ? 2 : 1;
  await db.update(loans).set({
    principalOutstandingZMW: newPrincipal,
    interestOutstandingZMW: newInterest,
    feesOutstandingZMW: newFees,
    totalOutstandingZMW: newOutstanding,
    status: newStatus,
    ifrs9Stage: newStage,
  }).where(eq(loans.id, loan.id));

  if (oldestDueInstallment) {
    const remainingForThis = oldestDueInstallment.totalDue - (oldestDueInstallment.totalPaid + totalPaid);
    const newInstStatus: 'PENDING' | 'PARTIAL' | 'PAID' = remainingForThis <= 0.01 ? 'PAID' : 'PARTIAL';
    await db.update(repaymentSchedule).set({
      principalPaid: oldestDueInstallment.principalPaid + principalPaid,
      interestPaid: oldestDueInstallment.interestPaid + interestPaid,
      feesPaid: oldestDueInstallment.feesPaid + feesPaid,
      totalPaid: oldestDueInstallment.totalPaid + totalPaid,
      paidAt: new Date(),
      status: newInstStatus,
    }).where(eq(repaymentSchedule.id, oldestDueInstallment.id));
  }

  await audit({
    userId: session!.userId,
    action: 'RECORD_REPAYMENT',
    entity: 'REPAYMENT',
    entityId: repayment.id,
    meta: { receiptNo, loanId: loan.id, totalPaid, mmTxnId },
  });

  let ctrTriggered = false;
  let strTriggered = false;
  if (parsed.data.paymentMethod === 'CASH' || parsed.data.paymentMethod === 'MOBILE_MONEY') {
    const customerKey = parsed.data.msisdn ?? loan.borrowerPhone ?? loan.borrowerId;
    const sameDayTotal = await getSameDayCashTotalZMW(customerKey, new Date());
    const evalResult = evaluateTransactionForCtr(totalPaid, sameDayTotal);
    if (evalResult.triggersCtr) {
      const customerName = parsed.data.paidByName ?? `${loan.borrowerFirstName} ${loan.borrowerLastName}`;
      await openCtr({
        borrowerId: loan.borrowerId,
        loanId: loan.id,
        repaymentId: repayment.id,
        description: `Repayment ${receiptNo}: ${evalResult.reason}`,
        evidence: { txUSD: evalResult.amountUSD, cumulativeUSD: evalResult.amountUSD, amountZMW: totalPaid, customerKey },
        amountZMW: totalPaid,
        transactionDate: new Date(),
        transactionType: 'DEPOSIT',
        customerName,
        customerNrc: loan.borrowerNrcNumber ?? null,
      });
      ctrTriggered = true;
    }
  }
  if (parsed.data.paidByName && parsed.data.paidByName.trim() && `${loan.borrowerFirstName} ${loan.borrowerLastName}` !== parsed.data.paidByName.trim()) {
    await openStr({
      ruleCode: 'THIRD_PARTY_PAYER',
      borrowerId: loan.borrowerId,
      loanId: loan.id,
      repaymentId: repayment.id,
      description: `Repayment ${receiptNo} made by "${parsed.data.paidByName}" (${parsed.data.paidByRelation ?? 'unspecified'}) on loan ${loan.loanNo}.`,
      evidence: { payerName: parsed.data.paidByName, payerRelation: parsed.data.paidByRelation, totalPaid, paymentMethod: parsed.data.paymentMethod },
    });
    strTriggered = true;
  }

  await runAllDetectors({
    borrowerId: loan.borrowerId,
    totalPaidZMW: totalPaid,
    msisdn: parsed.data.msisdn ?? null,
  });

  if (strTriggered || ctrTriggered) {
    await db.update(repayments).set({
      triggersStr: strTriggered,
      triggersCtr: ctrTriggered,
    }).where(eq(repayments.id, repayment.id));
  }

  return NextResponse.json({
    ok: true,
    receiptNo,
    newOutstanding,
    ctrTriggered,
    strTriggered,
  });
}
