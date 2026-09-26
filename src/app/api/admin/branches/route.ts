import { NextRequest, NextResponse } from 'next/server';
import { readJsonBody } from '@/lib/request-body';
import { z } from 'zod';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { branches } from '@/lib/db/schema';
import { getSessionFromRequest, AuthorizationError } from '@/lib/auth';
import { assertRole } from '@/lib/rbac';
import { audit } from '@/lib/audit';

const schema = z.object({
  name: z.string().min(1),
  code: z.string().min(1).max(20),
  province: z.string().optional(),
  city: z.string().optional(),
  address: z.string().optional(),
  phone: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  bozBranchCode: z.string().optional(),
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
  const existing = await db.select().from(branches).where(eq(branches.code, parsed.data.code)).limit(1);
  if (existing.length > 0) return NextResponse.json({ error: 'Branch code already in use' }, { status: 409 });
  const [branch] = await db.insert(branches).values(parsed.data).returning();
  await audit({
    userId: session!.userId,
    action: 'CREATE_BRANCH',
    entity: 'BRANCH',
    entityId: branch.id,
    meta: { code: branch.code },
  });
  return NextResponse.json({ ok: true, branch });
}
