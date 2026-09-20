import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
import { getSessionFromRequest, AuthorizationError, requireSession } from '@/lib/auth';
import { audit } from '@/lib/audit';

const schema = z.object({
  action: z.enum(['investigate', 'report_to_fic', 'dismiss', 'escalate']),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  let session: Awaited<ReturnType<typeof getSessionFromRequest>>;
  try {
    session = await getSessionFromRequest(req);
    requireSession(session, ['ADMIN', 'COMPLIANCE_OFFICER']);
  } catch (e) {
    if (e instanceof AuthorizationError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  const alert = await prisma.amlAlert.findUnique({ where: { id: params.id } });
  if (!alert) return NextResponse.json({ error: 'Alert not found' }, { status: 404 });

  let newStatus: 'INVESTIGATING' | 'REPORTED_TO_FIC' | 'DISMISSED' | 'ESCALATED';
  switch (parsed.data.action) {
    case 'investigate': newStatus = 'INVESTIGATING'; break;
    case 'report_to_fic': newStatus = 'REPORTED_TO_FIC'; break;
    case 'dismiss': newStatus = 'DISMISSED'; break;
    case 'escalate': newStatus = 'ESCALATED'; break;
  }

  await prisma.amlAlert.update({
    where: { id: alert.id },
    data: {
      status: newStatus,
      reviewedAt: new Date(),
      reviewedById: session!.userId,
      resolutionNotes: parsed.data.notes ?? null,
    },
  });

  if (parsed.data.action === 'report_to_fic') {
    if (alert.alertType === 'STR') {
      await prisma.strRecord.updateMany({
        where: { alertId: alert.id },
        data: { status: 'SUBMITTED_TO_FIC', filedAt: new Date(), filedById: session!.userId },
      });
    } else if (alert.alertType === 'CTR') {
      await prisma.ctrRecord.updateMany({
        where: { alertId: alert.id },
        data: { status: 'SUBMITTED_TO_FIC', submittedAt: new Date() },
      });
    }
  }

  await audit({
    userId: session!.userId,
    action: parsed.data.action === 'report_to_fic' ? (alert.alertType === 'STR' ? 'STR_FILED' : 'CTR_FILED') : 'AML_ALERT_REVIEWED',
    entity: 'AML_ALERT',
    entityId: alert.id,
    meta: { newStatus, notes: parsed.data.notes ?? '' },
  });

  return NextResponse.json({ ok: true });
}
