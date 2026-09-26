import { NextRequest, NextResponse } from 'next/server';
import { readJsonBody } from '@/lib/request-body';
import { z } from 'zod';
import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { getSessionFromRequest, hashPassword, AuthorizationError } from '@/lib/auth';
import { assertRole } from '@/lib/rbac';
import { audit } from '@/lib/audit';

const createSchema = z.object({
  fullName: z.string().min(1),
  email: z.string().email(),
  phone: z.string().optional(),
  role: z.enum(['ADMIN', 'BRANCH_MANAGER', 'CREDIT_OFFICER', 'LOAN_OFFICER', 'CASHIER', 'COMPLIANCE_OFFICER', 'AUDITOR']),
  branchId: z.string().min(1),
  fitProperStatus: z.enum(['PASSED', 'PENDING', 'FAILED']).nullable().optional(),
});

function generateTempPassword(): string {
  // 14 chars: 3 word + 4 hex + 1 symbol-ish suffix. Memorable but unpredictable.
  const adj = ['Swift', 'Bright', 'Calm', 'Kind', 'Brave', 'Sharp', 'Wise', 'Calm', 'Quick', 'Strong'];
  const noun = ['Zebra', 'Lion', 'Eagle', 'River', 'Acorn', 'Pillar', 'Mountain', 'Harbor', 'Lantern', 'Compass'];
  const a = adj[crypto.randomInt(adj.length)];
  const n = noun[crypto.randomInt(noun.length)];
  const hex = crypto.randomBytes(2).toString('hex');
  return `${a}-${n}-${hex}!`;
}

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
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });

  const existing = await db.select().from(users).where(eq(users.email, parsed.data.email)).limit(1);
  if (existing.length > 0) return NextResponse.json({ error: 'Email already in use' }, { status: 409 });

  const tempPassword = generateTempPassword();
  const hash = await hashPassword(tempPassword);
  const [user] = await db.insert(users).values({
    email: parsed.data.email,
    passwordHash: hash,
    fullName: parsed.data.fullName,
    phone: parsed.data.phone ?? null,
    role: parsed.data.role,
    branchId: parsed.data.branchId,
    fitProperStatus: parsed.data.fitProperStatus ?? null,
  }).returning();
  await audit({
    userId: session!.userId,
    action: 'CREATE_USER',
    entity: 'USER',
    entityId: user.id,
    meta: { email: user.email, role: user.role, fitProperStatus: parsed.data.fitProperStatus ?? null },
  });
  // Returned only at creation — never persisted.
  return NextResponse.json({ ok: true, userId: user.id, tempPassword });
}
