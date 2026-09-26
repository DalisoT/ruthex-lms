import { NextRequest, NextResponse } from 'next/server';
import { readJsonBody } from '@/lib/request-body';
import { z } from 'zod';
import { eq, and, ne } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { getSessionFromRequest, AuthorizationError } from '@/lib/auth';
import { assertRole } from '@/lib/rbac';
import { audit } from '@/lib/audit';

const patchSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  role: z.enum(['ADMIN', 'BRANCH_MANAGER', 'CREDIT_OFFICER', 'LOAN_OFFICER', 'CASHIER', 'COMPLIANCE_OFFICER', 'AUDITOR']),
  branchId: z.string().nullable().optional(),
  fitProperStatus: z.enum(['PASSED', 'PENDING', 'FAILED']).nullable().optional(),
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
  const body = await readJsonBody(req);
  if (body === null) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  const beforeRows = await db.select().from(users).where(eq(users.id, params.id)).limit(1);
  const before = beforeRows[0];
  if (!before) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  if (before.id === session!.userId && (parsed.data.role !== 'ADMIN' || !parsed.data.active)) {
    return NextResponse.json({ error: 'You cannot demote or disable your own admin account.' }, { status: 400 });
  }
  if (before.role === 'ADMIN' && parsed.data.role !== 'ADMIN') {
    const remaining = await db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.role, 'ADMIN'), eq(users.active, true), ne(users.id, before.id)));
    if (remaining.length === 0) {
      return NextResponse.json({ error: 'Cannot demote the last remaining admin.' }, { status: 400 });
    }
  }

  await db.update(users).set({
    fullName: parsed.data.fullName,
    email: parsed.data.email,
    phone: parsed.data.phone ?? null,
    role: parsed.data.role,
    branchId: parsed.data.branchId ?? null,
    fitProperStatus: parsed.data.fitProperStatus ?? null,
    active: parsed.data.active,
  }).where(eq(users.id, params.id));

  await audit({
    userId: session!.userId,
    action: 'UPDATE_USER',
    entity: 'USER',
    entityId: params.id,
    meta: {
      before: { role: before.role, fitProperStatus: before.fitProperStatus, active: before.active },
      after: { role: parsed.data.role, fitProperStatus: parsed.data.fitProperStatus, active: parsed.data.active },
    },
  });

  return NextResponse.json({ ok: true });
}
