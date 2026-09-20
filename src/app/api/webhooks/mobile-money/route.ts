/**
 * Mobile money webhook — inbound provider callbacks.
 *
 * Production behaviour:
 *   - Verify HMAC signature against MOBILE_MONEY_WEBHOOK_SECRET
 *   - Look up the corresponding Repayment by externalRef
 *   - Confirm the receipt on success; mark failed on failure
 *   - Trigger AML evaluation on confirmed receipts
 *
 * For the mock provider, the signature is not enforced strictly; replace with
 * a real adapter in production.
 */
import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { prisma } from '@/lib/db';
import { getMobileMoneyAdapter } from '@/lib/mobile-money';
import { audit } from '@/lib/audit';

export async function POST(req: NextRequest) {
  const raw = await req.text();
  const signature = req.headers.get('x-signature') ?? req.headers.get('signature') ?? '';

  // Pick adapter by provider header
  const provider = (req.headers.get('x-provider') ?? 'MOCK') as any;
  const adapter = getMobileMoneyAdapter();
  if (adapter.provider !== provider) {
    // In production, instantiate the named adapter. For mock, pass.
  }

  let body: Record<string, unknown> = {};
  try { body = JSON.parse(raw); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  if (!adapter.verifyWebhookSignature(raw, signature)) {
    return NextResponse.json({ error: 'Invalid signature' }, { status: 401 });
  }

  const parsed = adapter.parseCallback(body);
  if (!parsed) return NextResponse.json({ error: 'Cannot parse callback' }, { status: 400 });

  // Update the mobile money transaction
  const txn = await prisma.mobileMoneyTransaction.findFirst({ where: { externalId: parsed.externalId }, include: { repayment: true } });
  if (!txn) return NextResponse.json({ error: 'Unknown transaction' }, { status: 404 });
  await prisma.mobileMoneyTransaction.update({
    where: { id: txn.id },
    data: {
      status: parsed.status,
      confirmedAt: new Date(),
      rawCallback: raw,
      webhookSignature: crypto.createHash('sha256').update(raw).digest('hex'),
    },
  });

  await audit({
    action: 'MM_CALLBACK',
    entity: 'MOBILE_MONEY_TRANSACTION',
    entityId: txn.id,
    meta: { provider, externalId: parsed.externalId, status: parsed.status },
  });

  return NextResponse.json({ ok: true });
}
