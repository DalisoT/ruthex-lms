import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getSessionFromRequest, AuthorizationError, requireSession } from '@/lib/auth';
import { audit } from '@/lib/audit';

const schema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  let session: Awaited<ReturnType<typeof getSessionFromRequest>>;
  try {
    session = await getSessionFromRequest(req);
    requireSession(session, ['ADMIN', 'BRANCH_MANAGER', 'COMPLIANCE_OFFICER']);
  } catch (e) {
    if (e instanceof AuthorizationError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  const borrower = await prisma.borrower.findUnique({ where: { id: params.id } });
  if (!borrower) return NextResponse.json({ error: 'Borrower not found' }, { status: 404 });

  await prisma.borrower.update({
    where: { id: params.id },
    data: {
      kycStatus: parsed.data.decision,
      kycReviewedAt: new Date(),
      kycReviewerId: session!.userId,
      kycRiskRating: parsed.data.decision === 'APPROVED' ? (borrower.pepFlag ? 'HIGH' : 'LOW') : 'HIGH',
      kycExpiresAt: parsed.data.decision === 'APPROVED'
        ? new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)
        : null,
    },
  });
  await prisma.kycRiskAssessment.create({
    data: {
      borrowerId: params.id,
      assessedById: session!.userId,
      riskRating: parsed.data.decision === 'APPROVED' ? (borrower.pepFlag ? 'HIGH' : 'LOW') : 'HIGH',
      totalScore: parsed.data.decision === 'APPROVED' ? 30 : 100,
      decision: parsed.data.decision === 'APPROVED' ? 'APPROVE' : 'DECLINE',
      decisionReason: parsed.data.notes ?? '',
    },
  });

  await audit({
    userId: session!.userId,
    action: parsed.data.decision === 'APPROVED' ? 'KYC_APPROVED' : 'KYC_REJECTED',
    entity: 'BORROWER',
    entityId: params.id,
    meta: { notes: parsed.data.notes ?? '' },
  });

  return NextResponse.json({ ok: true });
}
