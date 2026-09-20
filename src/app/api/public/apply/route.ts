import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { nextBorrowerNo, nextApplicationNo, normalizeNrc } from '@/lib/utils';
import { computeCreditScore, buildDefaultAltDataInputs } from '@/lib/credit-score';

const schema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  middleName: z.string().optional(),
  nrcNumber: z.string().optional(),
  phone: z.string().min(1),
  email: z.string().email().optional().or(z.literal('')),
  addressLine1: z.string().optional(),
  city: z.string().optional(),
  province: z.string().optional(),
  employmentStatus: z.string().optional(),
  employerName: z.string().optional(),
  occupation: z.string().optional(),
  monthlyIncomeZMW: z.number().nullable().optional(),
  productId: z.string().min(1),
  requestedAmountZMW: z.number().min(1),
  requestedTermMonths: z.number().int().min(1),
  purpose: z.string(),
  purposeDetail: z.string().optional(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });

  const product = await prisma.loanProduct.findUnique({ where: { id: parsed.data.productId } });
  if (!product || !product.active) return NextResponse.json({ error: 'Product not available' }, { status: 400 });
  if (parsed.data.requestedAmountZMW < product.minAmountZMW || parsed.data.requestedAmountZMW > product.maxAmountZMW) {
    return NextResponse.json({ error: `Amount must be between K${product.minAmountZMW} and K${product.maxAmountZMW}` }, { status: 400 });
  }
  if (parsed.data.requestedTermMonths < product.minTermMonths || parsed.data.requestedTermMonths > product.maxTermMonths) {
    return NextResponse.json({ error: `Term must be between ${product.minTermMonths} and ${product.maxTermMonths} months` }, { status: 400 });
  }

  const count = await prisma.borrower.count();
  const borrowerNo = nextBorrowerNo(count + 1);

  const borrower = await prisma.borrower.create({
    data: {
      borrowerNo,
      firstName: parsed.data.firstName,
      lastName: parsed.data.lastName,
      middleName: parsed.data.middleName ?? null,
      nrcNumber: parsed.data.nrcNumber ? normalizeNrc(parsed.data.nrcNumber) : null,
      phone: parsed.data.phone,
      email: parsed.data.email || null,
      addressLine1: parsed.data.addressLine1 ?? null,
      city: parsed.data.city ?? null,
      province: parsed.data.province ?? null,
      employmentStatus: parsed.data.employmentStatus ?? null,
      employerName: parsed.data.employerName ?? null,
      occupation: parsed.data.occupation ?? null,
      monthlyIncomeZMW: parsed.data.monthlyIncomeZMW ?? null,
      kycStatus: 'PENDING',
      kycRiskRating: 'MEDIUM',
      status: 'ACTIVE',
    },
  });

  // Run credit score preview
  const altInputs = await buildDefaultAltDataInputs(borrower.id);
  if (parsed.data.monthlyIncomeZMW && parsed.data.requestedAmountZMW && parsed.data.requestedTermMonths) {
    altInputs.monthlyInflowToLoanRatio = parsed.data.monthlyIncomeZMW / (parsed.data.requestedAmountZMW / (parsed.data.requestedTermMonths / 12));
  }
  const score = computeCreditScore(altInputs);

  const appCount = await prisma.loanApplication.count();
  const applicationNo = nextApplicationNo(appCount + 1);
  await prisma.loanApplication.create({
    data: {
      applicationNo,
      borrowerId: borrower.id,
      productId: product.id,
      requestedAmountZMW: parsed.data.requestedAmountZMW,
      requestedTermMonths: parsed.data.requestedTermMonths,
      purpose: parsed.data.purpose,
      purposeDetail: parsed.data.purposeDetail ?? null,
      creditScore: score.score,
      creditGrade: score.grade,
      creditFactors: JSON.stringify(score.factors),
      status: 'SUBMITTED',
      submittedAt: new Date(),
      altDataSnapshot: JSON.stringify(altInputs),
    },
  });

  return NextResponse.json({ ok: true, borrowerId: borrower.id, borrowerNo });
}
