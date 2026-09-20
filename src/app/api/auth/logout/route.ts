import { NextResponse } from 'next/server';
import { clearSessionCookie, getCurrentSession } from '@/lib/auth';
import { audit } from '@/lib/audit';

export async function POST() {
  const session = await getCurrentSession();
  if (session) {
    await audit({
      userId: session.userId,
      action: 'LOGOUT',
      entity: 'USER',
      entityId: session.userId,
    });
  }
  await clearSessionCookie();
  return NextResponse.json({ ok: true });
}
