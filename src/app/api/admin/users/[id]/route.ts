import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { prisma } from '@/lib/db';
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
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });

  const before = await prisma.user.findUnique({ where: { id: params.id } });
  if (!before) return NextResponse.json({ error: 'User not found' }, { status: 404 });
  // Prevent locking yourself out by demoting yourself
  if (before.id === session!.userId && (parsed.data.role !== 'ADMIN' || !parsed.data.active)) {
    return NextResponse.json({ error: 'You cannot demote or disable your own admin account.' }, { status: 400 });
  }
  // Prevent demoting the last remaining admin
  if (before.role === 'ADMIN' && parsed.data.role !== 'ADMIN') {
    const remaining = await prisma.user.count({ where: { role: 'ADMIN', active: true, id: { not: before.id } } });
    if (remaining === 0) {
      return NextResponse.json({ error: 'Cannot demote the last remaining admin.' }, { status: 400 });
    }
  }

  await prisma.user.update({
    where: { id: params.id },
    data: {
      fullName: parsed.data.fullName,
      email: parsed.data.email,
      phone: parsed.data.phone ?? null,
      role: parsed.data.role,
      branchId: parsed.data.branchId ?? null,
      fitProperStatus: parsed.data.fitProperStatus ?? null,
      active: parsed.data.active,
    },
  });

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
