import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getSessionFromRequest, AuthorizationError, requireSession } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { evaluateTransactionForCtr, getSameDayCashTotalZMW, openCtr, openStr, USD_TO_ZMW } from '@/lib/aml';
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

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  const loan = await prisma.loan.findUnique({
    where: { id: parsed.data.loanId },
    include: { borrower: true },
  });
  if (!loan) return NextResponse.json({ error: 'Loan not found' }, { status: 404 });

  // FIFO allocation: principal first, then interest, then fees
  const totalPaid = parsed.data.totalPaidZMW;
  let principalPaid = Math.min(loan.principalOutstandingZMW, totalPaid);
  let interestPaid = Math.min(loan.interestOutstandingZMW, Math.max(0, totalPaid - principalPaid));
  let feesPaid = Math.max(0, totalPaid - principalPaid - interestPaid);

  // Pick the oldest due installment for marking
  const oldestDueInstallment = await prisma.repaymentSchedule.findFirst({
    where: { loanId: loan.id, status: { in: ['PENDING', 'PARTIAL', 'OVERDUE'] } },
    orderBy: { dueDate: 'asc' },
  });

  const count = await prisma.repayment.count();
  const receiptNo = nextReceiptNo(count + 1);

  // If mobile money, initiate collection via adapter (mock auto-succeeds)
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

  const repayment = await prisma.repayment.create({
    data: {
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
      paidByName: parsed.data.paidByName,
      paidByRelation: parsed.data.paidByRelation,
      notes: parsed.data.notes,
    },
  });

  // Update loan outstanding + status + days in arrears
  const newPrincipal = Math.max(0, loan.principalOutstandingZMW - principalPaid);
  const newInterest = Math.max(0, loan.interestOutstandingZMW - interestPaid);
  const newFees = Math.max(0, loan.feesOutstandingZMW - feesPaid);
  const newOutstanding = newPrincipal + newInterest + newFees;
  let newStatus = loan.status;
  if (loan.status === 'PENDING_DISBURSEMENT' && loan.disbursedAt) newStatus = 'ACTIVE';
  if (newOutstanding <= 0.01) newStatus = 'CLOSED';
  if (loan.daysInArrears > 0 && newPrincipal > 0) {
    // still in arrears
    if (newStatus === 'ACTIVE') newStatus = 'IN_ARREARS';
  } else if (loan.daysInArrears === 0 && newStatus === 'IN_ARREARS') {
    newStatus = 'ACTIVE';
  }
  // Update IFRS 9 staging — provision simple reclass: stage 3 if days > 90
  const newStage = loan.daysInArrears > 90 ? 3 : loan.daysInArrears > 30 ? 2 : 1;
  await prisma.loan.update({
    where: { id: loan.id },
    data: {
      principalOutstandingZMW: newPrincipal,
      interestOutstandingZMW: newInterest,
      feesOutstandingZMW: newFees,
      totalOutstandingZMW: newOutstanding,
      status: newStatus,
      ifrs9Stage: newStage,
    },
  });

  // Mark installment progress
  if (oldestDueInstallment) {
    const remainingForThis = oldestDueInstallment.totalDue - (oldestDueInstallment.totalPaid + totalPaid);
    let newInstStatus: 'PENDING' | 'PARTIAL' | 'PAID' = 'PARTIAL';
    if (remainingForThis <= 0.01) newInstStatus = 'PAID';
    await prisma.repaymentSchedule.update({
      where: { id: oldestDueInstallment.id },
      data: {
        principalPaid: oldestDueInstallment.principalPaid + principalPaid,
        interestPaid: oldestDueInstallment.interestPaid + interestPaid,
        feesPaid: oldestDueInstallment.feesPaid + feesPaid,
        totalPaid: oldestDueInstallment.totalPaid + totalPaid,
        paidAt: new Date(),
        status: newInstStatus,
      },
    });
  }

  await audit({
    userId: session!.userId,
    action: 'RECORD_REPAYMENT',
    entity: 'REPAYMENT',
    entityId: repayment.id,
    meta: { receiptNo, loanId: loan.id, totalPaid, mmTxnId },
  });

  // AML engine — CTR evaluation and triggering
  let ctrTriggered = false;
  let strTriggered = false;
  if (parsed.data.paymentMethod === 'CASH' || parsed.data.paymentMethod === 'MOBILE_MONEY') {
    const customerKey = parsed.data.msisdn ?? loan.borrower.phone ?? loan.borrower.id;
    const sameDayTotal = await getSameDayCashTotalZMW(customerKey, new Date());
    const evalResult = evaluateTransactionForCtr(totalPaid, sameDayTotal);
    if (evalResult.triggersCtr) {
      const customerName = parsed.data.paidByName ?? `${loan.borrower.firstName} ${loan.borrower.lastName}`;
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
        customerNrc: loan.borrower.nrcNumber,
      });
      ctrTriggered = true;
    }
  }
  // STR: third-party payer flag
  if (parsed.data.paidByName && parsed.data.paidByName.trim() && loan.borrower.firstName + ' ' + loan.borrower.lastName !== parsed.data.paidByName.trim()) {
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

  // Extended AML: structuring, velocity, round-number, PEP-amount, loan cycling.
  // These run for every repayment; each writes its own STR alert as needed.
  await runAllDetectors({
    borrowerId: loan.borrowerId,
    totalPaidZMW: totalPaid,
    msisdn: parsed.data.msisdn ?? null,
  });
  if (strTriggered) await prisma.repayment.update({ where: { id: repayment.id }, data: { triggersStr: true } });
  if (ctrTriggered) await prisma.repayment.update({ where: { id: repayment.id }, data: { triggersCtr: true } });

  return NextResponse.json({
    ok: true,
    receiptNo,
    newOutstanding,
    ctrTriggered,
    strTriggered,
  });
}
