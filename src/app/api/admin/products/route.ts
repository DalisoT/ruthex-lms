import { NextRequest, NextResponse } from 'next/server';
import { readJsonBody } from '@/lib/request-body';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { loanProducts } from '@/lib/db/schema';
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

export async function POST(req: NextRequest) {
  let session: Awaited<ReturnType<typeof getSessionFromRequest>>;
  try {
    session = await getSessionFromRequest(req);
    assertRole(session, 'admin');
  } catch (e) {
    if (e instanceof AuthorizationError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const body = await readJsonBody(req);
  if (body === null) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  if (parsed.data.minTermMonths > parsed.data.maxTermMonths) return NextResponse.json({ error: 'minTermMonths cannot exceed maxTermMonths' }, { status: 400 });
  if (parsed.data.minAmountZMW > parsed.data.maxAmountZMW) return NextResponse.json({ error: 'minAmountZMW cannot exceed maxAmountZMW' }, { status: 400 });
  const existing = await db.select().from(loanProducts).where(eq(loanProducts.name, parsed.data.name)).limit(1);
  if (existing.length > 0) return NextResponse.json({ error: 'Product with this name already exists' }, { status: 409 });
  const [product] = await db.insert(loanProducts).values(parsed.data).returning();
  await audit({
    userId: session!.userId,
    action: 'CREATE_LOAN_PRODUCT',
    entity: 'LOAN_PRODUCT',
    entityId: product.id,
    meta: { name: product.name },
  });
  return NextResponse.json({ ok: true, product });
}
