/**
 * Mobile money provider abstraction.
 *
 * Zambia's three mobile-money providers (MTN MoMo, Airtel Money, Zamtel Money)
 * each have their own API quirks. We isolate the differences behind a single
 * interface so the rest of the system can switch providers or test with a mock.
 *
 * In production, implement the real provider SDKs and set
 * MOBILE_MONEY_PROVIDER=mtn | airtel | zamtel in the environment. The default
 * "mock" provider is wired for local dev and tests.
 */
import crypto from 'crypto';
import { db } from './db';
import { mobileMoneyTransactions } from './db/schema';
import { MobileMoneyProvider } from './types';

// -----------------------------------------------------------------------------
// INTERFACE
// -----------------------------------------------------------------------------

export interface MobileMoneyRequest {
  direction: 'INBOUND' | 'OUTBOUND';
  amountZMW: number;
  msisdn: string;        // 260XXXXXXXXX format preferred
  accountRef?: string;  // e.g. loanNo or borrowerNo
  narration?: string;
  repaymentId?: string;
}

export interface MobileMoneyResponse {
  externalId: string;
  status: 'PENDING' | 'SUCCESSFUL' | 'FAILED';
  amountZMW: number;
  feesZMW: number;
  raw: Record<string, unknown>;
}

export interface MobileMoneyAdapter {
  readonly provider: MobileMoneyProvider;
  requestCollection(req: MobileMoneyRequest): Promise<MobileMoneyResponse>;
  requestDisbursement(req: MobileMoneyRequest): Promise<MobileMoneyResponse>;
  parseCallback(body: Record<string, unknown>): { externalId: string; status: 'SUCCESSFUL' | 'FAILED'; msisdn?: string; amountZMW?: number } | null;
  verifyWebhookSignature(body: string, signature: string): boolean;
}

// -----------------------------------------------------------------------------
// MOCK ADAPTER (default for local dev)
// -----------------------------------------------------------------------------

export class MockMobileMoneyAdapter implements MobileMoneyAdapter {
  readonly provider: MobileMoneyProvider = 'MOCK';

  async requestCollection(req: MobileMoneyRequest): Promise<MobileMoneyResponse> {
    const externalId = `MOCK-${Date.now()}-${crypto.randomBytes(3).toString('hex')}`;
    // Persist pending txn
    await db.insert(mobileMoneyTransactions).values({
      provider: this.provider,
      externalId,
      direction: req.direction,
      amountZMW: req.amountZMW,
      feesZMW: 0,
      msisdn: req.msisdn,
      accountRef: req.accountRef ?? null,
      status: 'SUCCESSFUL', // mock auto-succeeds
      repaymentId: req.repaymentId ?? null,
      confirmedAt: new Date(),
    });
    return {
      externalId,
      status: 'SUCCESSFUL',
      amountZMW: req.amountZMW,
      feesZMW: 0,
      raw: { provider: this.provider, mocked: true },
    };
  }

  async requestDisbursement(req: MobileMoneyRequest): Promise<MobileMoneyResponse> {
    return this.requestCollection(req);
  }

  parseCallback(body: Record<string, unknown>): { externalId: string; status: 'SUCCESSFUL' | 'FAILED'; msisdn?: string; amountZMW?: number } | null {
    if (typeof body.externalId !== 'string') return null;
    const status: 'SUCCESSFUL' | 'FAILED' = body.status === 'SUCCESSFUL' ? 'SUCCESSFUL' : 'FAILED';
    return {
      externalId: body.externalId,
      status,
      msisdn: typeof body.msisdn === 'string' ? body.msisdn : undefined,
      amountZMW: typeof body.amountZMW === 'number' ? body.amountZMW : undefined,
    };
  }

  verifyWebhookSignature(body: string, signature: string): boolean {
    // Mock always passes; replace with HMAC verification for real providers.
    return signature === 'mock-signature' || signature.length > 0;
  }
}

// -----------------------------------------------------------------------------
// FACTORY (one adapter per provider)
// -----------------------------------------------------------------------------

let _adapter: MobileMoneyAdapter | null = null;

export function getMobileMoneyAdapter(): MobileMoneyAdapter {
  if (_adapter) return _adapter;
  const provider = (process.env.MOBILE_MONEY_PROVIDER ?? 'mock') as MobileMoneyProvider;
  switch (provider) {
    case 'MOCK':
    default:
      _adapter = new MockMobileMoneyAdapter();
      return _adapter;
    // case 'mtn':    _adapter = new MtnMoMoAdapter(); return _adapter;
    // case 'airtel': _adapter = new AirtelMoneyAdapter(); return _adapter;
    // case 'zamtel': _adapter = new ZamtelMoneyAdapter(); return _adapter;
  }
}

/** Normalize Zambian phone to 260XXXXXXXXX format. */
export function normalizeMsisdn(input: string): string {
  const trimmed = input.replace(/[^\d+]/g, '');
  if (trimmed.startsWith('+260')) return '260' + trimmed.slice(4);
  if (trimmed.startsWith('260')) return trimmed;
  if (trimmed.startsWith('0')) return '260' + trimmed.slice(1);
  return trimmed;
}
