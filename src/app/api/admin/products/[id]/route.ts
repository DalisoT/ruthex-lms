import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getSessionFromRequest, AuthorizationError } from '@/lib/auth';
import { assertRole } from '@/lib/rbac';
import { audit } from '@/lib/audit';

const schema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  interestRateAnnualPct: z.number().min(0).max(1000),
  interestMethod: z.enum(['FLAT', 'REDUCING_BALANCE', 'COMPOUND']),
  minTermMonths: z.number().int().min(1),
  maxTermMonths: z.number().int().min(1),
  minAmountZMW: z.number().min(1),
  maxAmountZMW: z.number().min(1),
  disbursementChannels: z.string().min(1),
  repaymentFrequency: z.enum(['DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'LUMP_SUM']),
  gracePeriodDays: z.number().int().min(0),
  applicationFeeZMW: z.number().min(0),
  processingFeePct: z.number().min(0),
  requiresCollateral: z.boolean(),
  active: z.boolean(),
});

export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  let session: Awaited<ReturnType<typeof getSessionFromRequest>>;
  try {
    session = await getSessionFromRequest(req);
    assertRole(session, 'admin');
  } catch (e) {
    if (e instanceof AuthorizationError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  if (parsed.data.minTermMonths > parsed.data.maxTermMonths) return NextResponse.json({ error: 'minTermMonths cannot exceed maxTermMonths' }, { status: 400 });
  if (parsed.data.minAmountZMW > parsed.data.maxAmountZMW) return NextResponse.json({ error: 'minAmountZMW cannot exceed maxAmountZMW' }, { status: 400 });
  const before = await prisma.loanProduct.findUnique({ where: { id: params.id } });
  if (!before) return NextResponse.json({ error: 'Product not found' }, { status: 404 });
  const product = await prisma.loanProduct.update({ where: { id: params.id }, data: parsed.data });
  await audit({
    userId: session!.userId,
    action: 'UPDATE_LOAN_PRODUCT',
    entity: 'LOAN_PRODUCT',
    entityId: product.id,
    meta: { name: product.name, changedFields: Object.keys(parsed.data) },
  });
  return NextResponse.json({ ok: true, product });
}
