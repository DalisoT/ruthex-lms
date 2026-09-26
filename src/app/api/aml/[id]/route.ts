import { NextRequest, NextResponse } from 'next/server';
import { readJsonBody } from '@/lib/request-body';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { amlAlerts, strRecords, ctrRecords } from '@/lib/db/schema';
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
  const body = await readJsonBody(req);
  if (body === null) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  const rows = await db.select().from(amlAlerts).where(eq(amlAlerts.id, params.id)).limit(1);
  const alert = rows[0];
  if (!alert) return NextResponse.json({ error: 'Alert not found' }, { status: 404 });

  let newStatus: 'INVESTIGATING' | 'REPORTED_TO_FIC' | 'DISMISSED' | 'ESCALATED';
  switch (parsed.data.action) {
    case 'investigate': newStatus = 'INVESTIGATING'; break;
    case 'report_to_fic': newStatus = 'REPORTED_TO_FIC'; break;
    case 'dismiss': newStatus = 'DISMISSED'; break;
    case 'escalate': newStatus = 'ESCALATED'; break;
  }

  await db.update(amlAlerts).set({
    status: newStatus,
    reviewedAt: new Date(),
    reviewedById: session!.userId,
    resolutionNotes: parsed.data.notes ?? null,
  }).where(eq(amlAlerts.id, alert.id));

  if (parsed.data.action === 'report_to_fic') {
    if (alert.alertType === 'STR') {
      await db.update(strRecords).set({ status: 'DRAFT' }).where(eq(strRecords.alertId, alert.id));
    } else if (alert.alertType === 'CTR') {
      await db.update(ctrRecords).set({ status: 'DRAFT' }).where(eq(ctrRecords.alertId, alert.id));
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
