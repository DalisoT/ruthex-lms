/**
 * USSD endpoint — the *123# feature-phone origination channel.
 *
 * Africa's Talking (or any provider) posts session data here:
 *   - sessionId
 *   - serviceCode   (e.g. "*123#")
 *   - phone         (260XXXXXXXXX)
 *   - text          (accumulated user input so far)
 *
 * Respond with a CON/END string per the gateway protocol.
 */
import { NextRequest, NextResponse } from 'next/server';
import { readJsonBody } from '@/lib/request-body';
import { z } from 'zod';
import { processUssd } from '@/lib/notifications';
import { db } from '@/lib/db';
import { notifications } from '@/lib/db/schema';
import { audit } from '@/lib/audit';

const schema = z.object({
  sessionId: z.string(),
  serviceCode: z.string(),
  msisdn: z.string(),
  text: z.string().default(''),
});

export async function POST(req: NextRequest) {
  // The gateway may post as application/x-www-form-urlencoded or JSON.
  // Handle both transparently.
  let body: Record<string, string> = {};
  const contentType = req.headers.get('content-type') ?? '';
  if (contentType.includes('application/json')) {
    const j = (await readJsonBody(req)) ?? {};
    body = j as Record<string, string>;
  } else {
    const form = await req.formData().catch(() => null);
    if (form) {
      form.forEach((v, k) => { body[k] = String(v); });
    } else {
      const text = await req.text();
      new URLSearchParams(text).forEach((v, k) => { body[k] = v; });
    }
  }

  const parsed = schema.safeParse(body);
  if (!parsed.success) return new NextResponse('END Invalid request', { status: 400, headers: { 'Content-Type': 'text/plain' } });

  const response = processUssd(parsed.data);
  const isTerminal = response.startsWith('END');
  await audit({
    action: 'USSD_SESSION',
    entity: 'USSD',
    meta: { sessionId: parsed.data.sessionId, msisdn: parsed.data.msisdn, terminal: isTerminal },
  });

  // Log to DB for audit / analytics
  await db.insert(notifications).values({
    channel: 'USSD',
    recipient: parsed.data.msisdn,
    body: response,
    status: 'SENT',
    sentAt: new Date(),
    relatedEntity: 'USSD',
    relatedEntityId: parsed.data.sessionId,
  });

  return new NextResponse(response, { headers: { 'Content-Type': 'text/plain' } });
}
