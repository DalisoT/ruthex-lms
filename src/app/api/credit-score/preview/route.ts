import { NextRequest, NextResponse } from 'next/server';
import { readJsonBody } from '@/lib/request-body';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { borrowers } from '@/lib/db/schema';
import { getSessionFromRequest } from '@/lib/auth';
import { computeCreditScore, buildDefaultAltDataInputs } from '@/lib/credit-score';

const schema = z.object({
  borrowerId: z.string().min(1),
  requestedAmountZMW: z.number().min(1).optional(),
  termMonths: z.number().int().min(1).optional(),
});

export async function POST(req: NextRequest) {
  const session = await getSessionFromRequest(req);
  if (!session) return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  const body = await readJsonBody(req);
  if (body === null) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  const rows = await db.select().from(borrowers).where(eq(borrowers.id, parsed.data.borrowerId)).limit(1);
  const borrower = rows[0];
  if (!borrower) return NextResponse.json({ error: 'Borrower not found' }, { status: 404 });

  const inputs = await buildDefaultAltDataInputs(parsed.data.borrowerId);
  if (parsed.data.requestedAmountZMW && borrower.monthlyIncomeZMW && borrower.monthlyIncomeZMW > 0) {
    const termFactor = (parsed.data.termMonths ?? 12) / 12;
    inputs.monthlyInflowToLoanRatio = borrower.monthlyIncomeZMW / (parsed.data.requestedAmountZMW / termFactor);
  }
  const result = computeCreditScore(inputs);
  return NextResponse.json(result);
}
