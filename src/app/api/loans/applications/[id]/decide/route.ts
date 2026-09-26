import { NextRequest, NextResponse } from 'next/server';
import { readJsonBody } from '@/lib/request-body';
import { z } from 'zod';
import { sql, eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { loanApplications, loanProducts, loans, loanApprovals, repaymentSchedule } from '@/lib/db/schema';
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
  const body = await readJsonBody(req);
  if (body === null) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  const applicationRows = await db
    .select({
      id: loanApplications.id,
      borrowerId: loanApplications.borrowerId,
      productId: loanApplications.productId,
      status: loanApplications.status,
      minAmountZMW: loanProducts.minAmountZMW,
      maxAmountZMW: loanProducts.maxAmountZMW,
      minTermMonths: loanProducts.minTermMonths,
      maxTermMonths: loanProducts.maxTermMonths,
      interestMethod: loanProducts.interestMethod,
      repaymentFrequency: loanProducts.repaymentFrequency,
    })
    .from(loanApplications)
    .innerJoin(loanProducts, eq(loanApplications.productId, loanProducts.id))
    .where(eq(loanApplications.id, params.id))
    .limit(1);
  const application = applicationRows[0];
  if (!application) return NextResponse.json({ error: 'Application not found' }, { status: 404 });
  if (application.status !== 'UNDER_REVIEW') {
    return NextResponse.json({ error: `Application is ${application.status} — cannot decide` }, { status: 400 });
  }

  if (parsed.data.decision === 'REJECTED') {
    await db.update(loanApplications).set({
      status: 'REJECTED',
      rejectionReason: parsed.data.reason ?? 'No reason provided',
      decisionedAt: new Date(),
      decidedById: session!.userId,
    }).where(eq(loanApplications.id, application.id));
    await db.insert(loanApprovals).values({
      applicationId: application.id,
      approverId: session!.userId,
      level: 'CREDIT_OFFICER',
      decision: 'REJECTED',
      reason: parsed.data.reason ?? '',
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

  if (!parsed.data.approvedAmountZMW || !parsed.data.approvedTermMonths || parsed.data.approvedRatePct == null) {
    return NextResponse.json({ error: 'Approve requires approved amount, term, and rate' }, { status: 400 });
  }
  if (parsed.data.approvedAmountZMW < application.minAmountZMW || parsed.data.approvedAmountZMW > application.maxAmountZMW) {
    return NextResponse.json({ error: 'Approved amount outside product limits' }, { status: 400 });
  }
  if (parsed.data.approvedTermMonths < application.minTermMonths || parsed.data.approvedTermMonths > application.maxTermMonths) {
    return NextResponse.json({ error: 'Approved term outside product limits' }, { status: 400 });
  }

  const loanCountRows = await db.select({ c: sql<number>`count(*)::int` }).from(loans);
  const loanNo = nextLoanNo((loanCountRows[0]?.c ?? 0) + 1);

  const startDate = new Date();
  const installments = buildAmortization(
    parsed.data.approvedAmountZMW,
    parsed.data.approvedRatePct,
    parsed.data.approvedTermMonths,
    application.repaymentFrequency as any,
    startDate,
    application.interestMethod as any
  );
  const installmentAmount = installments[0]?.totalDue ?? parsed.data.approvedAmountZMW;
  const firstDue = installments[0]?.dueDate ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  const maturity = installments[installments.length - 1]?.dueDate ?? new Date(Date.now() + parsed.data.approvedTermMonths * 30 * 24 * 60 * 60 * 1000);
  const totalRepayable = installments.reduce((s: any, i: any) => s + i.totalDue, 0);

  const [loan] = await db.insert(loans).values({
    loanNo,
    borrowerId: application.borrowerId,
    productId: application.productId,
    principalZMW: parsed.data.approvedAmountZMW,
    interestRateAnnualPct: parsed.data.approvedRatePct,
    interestMethod: application.interestMethod,
    termMonths: parsed.data.approvedTermMonths,
    repaymentFrequency: application.repaymentFrequency,
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
  }).returning();

  if (installments.length > 0) {
    await db.insert(repaymentSchedule).values(installments.map((inst: any) => ({
      loanId: loan.id,
      installmentNo: inst.installmentNo,
      dueDate: inst.dueDate,
      principalDue: inst.principalDue,
      interestDue: inst.interestDue,
      feesDue: 0,
      totalDue: inst.totalDue,
    })));
  }

  await db.update(loanApplications).set({
    status: 'APPROVED',
    approvedAmountZMW: parsed.data.approvedAmountZMW,
    approvedTermMonths: parsed.data.approvedTermMonths,
    approvedRatePct: parsed.data.approvedRatePct,
    decisionedAt: new Date(),
    decidedById: session!.userId,
    loanId: loan.id,
  }).where(eq(loanApplications.id, application.id));

  await db.insert(loanApprovals).values({
    applicationId: application.id,
    approverId: session!.userId,
    level: 'CREDIT_OFFICER',
    decision: 'APPROVED',
    reason: parsed.data.reason ?? '',
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
