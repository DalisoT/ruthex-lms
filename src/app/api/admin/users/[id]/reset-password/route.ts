import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { eq } from 'drizzle-orm';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { getSessionFromRequest, hashPassword, AuthorizationError } from '@/lib/auth';
import { assertRole } from '@/lib/rbac';
import { audit } from '@/lib/audit';

function generateTempPassword(): string {
  const adj = ['Swift', 'Bright', 'Calm', 'Kind', 'Brave', 'Sharp', 'Wise', 'Quick', 'Strong'];
  const noun = ['Zebra', 'Lion', 'Eagle', 'River', 'Acorn', 'Pillar', 'Mountain', 'Harbor', 'Lantern', 'Compass'];
  const a = adj[crypto.randomInt(adj.length)];
  const n = noun[crypto.randomInt(noun.length)];
  const hex = crypto.randomBytes(2).toString('hex');
  return `${a}-${n}-${hex}!`;
}

export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  let session: Awaited<ReturnType<typeof getSessionFromRequest>>;
  try {
    session = await getSessionFromRequest(req);
    assertRole(session, 'admin');
  } catch (e) {
    if (e instanceof AuthorizationError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const rows = await db.select().from(users).where(eq(users.id, params.id)).limit(1);
  const user = rows[0];
  if (!user) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  const tempPassword = generateTempPassword();
  const hash = await hashPassword(tempPassword);
  await db.update(users).set({ passwordHash: hash, failedLoginCount: 0 }).where(eq(users.id, user.id));
  await audit({
    userId: session!.userId,
    action: 'UPDATE_USER',
    entity: 'USER',
    entityId: user.id,
    meta: { change: 'password_reset' },
  });
  return NextResponse.json({ ok: true, tempPassword });
}
