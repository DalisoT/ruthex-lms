import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getSessionFromRequest, AuthorizationError, requireSession } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { computeCreditScore, buildDefaultAltDataInputs } from '@/lib/credit-score';
import { nextApplicationNo, nextLoanNo, buildAmortization } from '@/lib/utils';

const schema = z.object({
  borrowerId: z.string().min(1),
  productId: z.string().min(1),
  requestedAmountZMW: z.number().min(1),
  requestedTermMonths: z.number().int().min(1),
  purpose: z.string().min(1),
  purposeDetail: z.string().optional(),
});

export async function POST(req: NextRequest) {
  let session: Awaited<ReturnType<typeof getSessionFromRequest>>;
  try {
    session = await getSessionFromRequest(req);
    requireSession(session, ['ADMIN', 'BRANCH_MANAGER', 'CREDIT_OFFICER', 'LOAN_OFFICER']);
  } catch (e) {
    if (e instanceof AuthorizationError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  const borrower = await prisma.borrower.findUnique({ where: { id: parsed.data.borrowerId } });
  if (!borrower) return NextResponse.json({ error: 'Borrower not found' }, { status: 404 });
  if (borrower.kycStatus !== 'APPROVED') {
    return NextResponse.json({ error: 'Borrower KYC is not approved' }, { status: 400 });
  }
  const product = await prisma.loanProduct.findUnique({ where: { id: parsed.data.productId } });
  if (!product || !product.active) return NextResponse.json({ error: 'Product not available' }, { status: 400 });

  if (parsed.data.requestedAmountZMW < product.minAmountZMW || parsed.data.requestedAmountZMW > product.maxAmountZMW) {
    return NextResponse.json({ error: `Amount must be between K${product.minAmountZMW} and K${product.maxAmountZMW}` }, { status: 400 });
  }
  if (parsed.data.requestedTermMonths < product.minTermMonths || parsed.data.requestedTermMonths > product.maxTermMonths) {
    return NextResponse.json({ error: `Term must be between ${product.minTermMonths} and ${product.maxTermMonths} months` }, { status: 400 });
  }

  // Credit scoring
  const altInputs = await buildDefaultAltDataInputs(parsed.data.borrowerId);
  const result = computeCreditScore(altInputs);

  const appCount = await prisma.loanApplication.count();
  const applicationNo = nextApplicationNo(appCount + 1);

  // Auto-decide
  let status: 'SUBMITTED' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' = 'UNDER_REVIEW';
  let approvedAmount: number | null = null;
  let approvedTerm: number | null = null;
  let approvedRate: number | null = null;
  let rejectionReason: string | null = null;

  if (borrower.kycRiskRating === 'PROHIBITED' || result.recommendation === 'DECLINE') {
    status = 'REJECTED';
    rejectionReason = `Credit score ${result.score} (grade ${result.grade}) — auto-declined by policy.`;
  } else if (result.recommendation === 'APPROVE' && result.score >= 650) {
    // Auto-approve small loan requests up to K50,000 at the limit; otherwise route to officer
    if (parsed.data.requestedAmountZMW <= 50_000) {
      status = 'APPROVED';
      approvedAmount = parsed.data.requestedAmountZMW;
      approvedTerm = parsed.data.requestedTermMonths;
      approvedRate = product.interestRateAnnualPct;
    } else {
      status = 'UNDER_REVIEW';
    }
  }

  const application = await prisma.loanApplication.create({
    data: {
      applicationNo,
      borrowerId: parsed.data.borrowerId,
      productId: parsed.data.productId,
      requestedAmountZMW: parsed.data.requestedAmountZMW,
      requestedTermMonths: parsed.data.requestedTermMonths,
      purpose: parsed.data.purpose,
      purposeDetail: parsed.data.purposeDetail ?? null,
      creditScore: result.score,
      creditGrade: result.grade,
      creditFactors: JSON.stringify(result.factors),
      status,
      approvedAmountZMW: approvedAmount,
      approvedTermMonths: approvedTerm,
      approvedRatePct: approvedRate,
      rejectionReason,
      assignedOfficerId: session!.userId,
      submittedAt: new Date(),
      decisionedAt: status === 'APPROVED' || status === 'REJECTED' ? new Date() : null,
      decidedById: status === 'APPROVED' || status === 'REJECTED' ? session!.userId : null,
      altDataSnapshot: JSON.stringify(altInputs),
    },
  });

  // If approved, create the active loan record
  let loanId: string | null = null;
  if (status === 'APPROVED' && approvedAmount && approvedTerm) {
    const loanCount = await prisma.loan.count();
    const loanNo = nextLoanNo(loanCount + 1);

    // Build amortization to compute installment + first due date + maturity
    const startDate = new Date();
    const installments = buildAmortization(
      approvedAmount,
      product.interestRateAnnualPct,
      approvedTerm,
      product.repaymentFrequency as any,
      startDate,
      product.interestMethod as any
    );

    const installmentAmount = installments[0]?.totalDue ?? approvedAmount;
    const firstDue = installments[0]?.dueDate ?? new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    const maturity = installments[installments.length - 1]?.dueDate ?? new Date(Date.now() + approvedTerm * 30 * 24 * 60 * 60 * 1000);
    const totalRepayable = installments.reduce((s, i) => s + i.totalDue, 0);

    const loan = await prisma.loan.create({
      data: {
        loanNo,
        borrowerId: parsed.data.borrowerId,
        productId: product.id,
        principalZMW: approvedAmount,
        interestRateAnnualPct: product.interestRateAnnualPct,
        interestMethod: product.interestMethod,
        termMonths: approvedTerm,
        repaymentFrequency: product.repaymentFrequency,
        installmentZMW: installmentAmount,
        totalRepayableZMW: totalRepayable,
        firstPaymentDue: firstDue,
        maturityDate: maturity,
        status: 'PENDING_DISBURSEMENT',
        principalOutstandingZMW: approvedAmount,
        interestOutstandingZMW: 0,
        feesOutstandingZMW: 0,
        totalOutstandingZMW: approvedAmount,
      },
    });
    loanId = loan.id;
    await prisma.loanApplication.update({ where: { id: application.id }, data: { loanId } });

    // Persist repayment schedule
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
  }

  await audit({
    userId: session!.userId,
    action: 'CREATE_LOAN_APPLICATION',
    entity: 'LOAN_APPLICATION',
    entityId: application.id,
    meta: {
      applicationNo, status, score: result.score, grade: result.grade,
      borrowerId: parsed.data.borrowerId, requestedAmount: parsed.data.requestedAmountZMW,
    },
  });

  return NextResponse.json({ ok: true, applicationId: application.id, loanId, status, score: result });
}
