import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { login, setSessionCookie } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { consume, rateLimitKeyFromRequest, rateLimitResponse } from '@/lib/rate-limit';

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function POST(req: NextRequest) {
  // Rate limit by IP — 10 attempts per minute, max burst 10. Throttles credential
  // stuffing without inconveniencing a forgetful human.
  const limitKey = rateLimitKeyFromRequest(req, 'login');
  const rl = consume(limitKey, { rpm: 10, burst: 10 });
  if (!rl.allowed) return rateLimitResponse(rl);

  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Email and password required' }, { status: 400 });
  }
  const result = await login(parsed.data.email, parsed.data.password);
  if (!result) {
    await audit({
      action: 'LOGIN_FAILED',
      entity: 'USER',
      ipAddress: req.headers.get('x-forwarded-for') ?? null,
      userAgent: req.headers.get('user-agent') ?? null,
      meta: { email: parsed.data.email },
    });
    return NextResponse.json({ error: 'Invalid email or password' }, { status: 401 });
  }
  await setSessionCookie(result.token);
  await audit({
    userId: result.payload.userId,
    action: 'LOGIN',
    entity: 'USER',
    entityId: result.payload.userId,
    ipAddress: req.headers.get('x-forwarded-for') ?? null,
    userAgent: req.headers.get('user-agent') ?? null,
  });
  return NextResponse.json({ ok: true, role: result.payload.role });
}
