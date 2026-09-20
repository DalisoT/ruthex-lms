import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getSessionFromRequest, AuthorizationError } from '@/lib/auth';
import { assertRole } from '@/lib/rbac';
import { audit } from '@/lib/audit';
import { nextLoanNo, buildAmortization } from '@/lib/utils';

const schema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  reason: z.string().optional(),
  approvedAmountZMW: z.number().min(1).optional(),
  approvedTermMonths: z.number().int().min(1).optional(),
  approvedRatePct: z.number().min(0).max(1000).optional(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  let session: Awaited<ReturnType<typeof getSessionFromRequest>>;
  try {
    session = await getSessionFromRequest(req);
    assertRole(session, 'lending');
  } catch (e) {
    if (e instanceof AuthorizationError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  const application = await prisma.loanApplication.findUnique({
    where: { id: params.id },
    include: { product: true, borrower: true },
  });
  if (!application) return NextResponse.json({ error: 'Application not found' }, { status: 404 });
  if (application.status !== 'UNDER_REVIEW') {
    return NextResponse.json({ error: `Application is ${application.status} — cannot decide` }, { status: 400 });
  }

  if (parsed.data.decision === 'REJECTED') {
    await prisma.loanApplication.update({
      where: { id: application.id },
      data: {
        status: 'REJECTED',
        rejectionReason: parsed.data.reason ?? 'No reason provided',
        decisionedAt: new Date(),
        decidedById: session!.userId,
      },
    });
    await prisma.loanApproval.create({
      data: {
        applicationId: application.id,
        approverId: session!.userId,
        level: 'CREDIT_OFFICER',
        decision: 'REJECTED',
        reason: parsed.data.reason ?? '',
      },
    });
    await audit({
      userId: session!.userId,
      action: 'REJECT_LOAN',
      entity: 'LOAN_APPLICATION',
      entityId: application.id,
      meta: { reason: parsed.data.reason ?? '' },
    });
    return NextResponse.json({ ok: true });
  }

  // Approve path: validate amounts and persist the active loan
  if (!parsed.data.approvedAmountZMW || !parsed.data.approvedTermMonths || parsed.data.approvedRatePct == null) {
    return NextResponse.json({ error: 'Approve requires approved amount, term, and rate' }, { status: 400 });
  }
  const product = application.product;
  if (parsed.data.approvedAmountZMW < product.minAmountZMW || parsed.data.approvedAmountZMW > product.maxAmountZMW) {
    return NextResponse.json({ error: 'Approved amount outside product limits' }, { status: 400 });
  }
  if (parsed.data.approvedTermMonths < product.minTermMonths || parsed.data.approvedTermMonths > product.maxTermMonths) {
    return NextResponse.json({ error: 'Approved term outside product limits' }, { status: 400 });
  }

  const loanCount = await prisma.loan.count();
  const loanNo = nextLoanNo(loanCount + 1);

  const startDate = new Date();
  const installments = buildAmortization(
    parsed.data.approvedAmountZMW,
    parsed.data.approvedRatePct,
    parsed.data.approvedTermMonths,
    product.repaymentFrequency as any,
    startDate,
    product.interestMethod as any
  );
  const installmentAmount = installments[0]?.totalDue ?? parsed.data.approvedAmountZMW;
  const firstDue = installments[0]?.dueDate ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const maturity = installments[installments.length - 1]?.dueDate ?? new Date(Date.now() + parsed.data.approvedTermMonths * 30 * 24 * 60 * 60 * 1000);
  const totalRepayable = installments.reduce((s, i) => s + i.totalDue, 0);

  const loan = await prisma.loan.create({
    data: {
      loanNo,
      borrowerId: application.borrowerId,
      productId: product.id,
      principalZMW: parsed.data.approvedAmountZMW,
      interestRateAnnualPct: parsed.data.approvedRatePct,
      interestMethod: product.interestMethod,
      termMonths: parsed.data.approvedTermMonths,
      repaymentFrequency: product.repaymentFrequency,
      installmentZMW: installmentAmount,
      totalRepayableZMW: totalRepayable,
      firstPaymentDue: firstDue,
      maturityDate: maturity,
      status: 'PENDING_DISBURSEMENT',
      principalOutstandingZMW: parsed.data.approvedAmountZMW,
      interestOutstandingZMW: 0,
      feesOutstandingZMW: 0,
      totalOutstandingZMW: parsed.data.approvedAmountZMW,
      pricingOverrideReason: parsed.data.reason ?? null,
    },
  });
  for (const inst of installments) {
    await prisma.repaymentSchedule.create({
      data: {
        loanId: loan.id,
        installmentNo: inst.installmentNo,
        dueDate: inst.dueDate,
        principalDue: inst.principalDue,
        interestDue: inst.interestDue,
        feesDue: 0,
        totalDue: inst.totalDue,
      },
    });
  }

  await prisma.loanApplication.update({
    where: { id: application.id },
    data: {
      status: 'APPROVED',
      approvedAmountZMW: parsed.data.approvedAmountZMW,
      approvedTermMonths: parsed.data.approvedTermMonths,
      approvedRatePct: parsed.data.approvedRatePct,
      decisionedAt: new Date(),
      decidedById: session!.userId,
      loanId: loan.id,
    },
  });

  await prisma.loanApproval.create({
    data: {
      applicationId: application.id,
      approverId: session!.userId,
      level: 'CREDIT_OFFICER',
      decision: 'APPROVED',
      reason: parsed.data.reason ?? '',
    },
  });

  await audit({
    userId: session!.userId,
    action: 'APPROVE_LOAN',
    entity: 'LOAN_APPLICATION',
    entityId: application.id,
    meta: { approvedAmount: parsed.data.approvedAmountZMW, approvedTerm: parsed.data.approvedTermMonths, approvedRate: parsed.data.approvedRatePct, loanId: loan.id },
  });

  return NextResponse.json({ ok: true, loanId: loan.id });
}
