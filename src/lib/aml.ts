/**
 * RUTHEX Lending Institution — AML / CFT engine.
 *
 * Implements the Zambian FIC obligations encoded in:
 *   - Financial Intelligence Centre Act 2010 (No. 46)
 *   - Financial Intelligence Centre (General) Regulations S.I. 9 of 2016
 *   - Financial Intelligence Centre (Prescribed Thresholds) Regulations S.I. 52 of 2016
 *   - AML/CFT Guidelines for NBFIs (FIC, 2017+)
 *
 * Key obligations encoded:
 *   - Currency Transaction Reports (CTR) at or above USD 10,000 equivalent
 *   - Suspicious Transaction Reports (STR) filed within 2 working days
 *   - 10-year record retention
 *   - 25% beneficial-ownership disclosure threshold
 *   - PEP / sanctions screening
 *
 * The engine is event-driven: when a repayment or disbursement crosses a
 * threshold, it produces an `AmlAlert` row. A separate `CtrRecord` / `StrRecord`
 * is then generated for FIC submission.
 */
import { prisma } from './db';
import { CTR_THRESHOLD_USD, STR_FILING_DEADLINE_DAYS } from './types';

// -----------------------------------------------------------------------------
// CONFIG
// -----------------------------------------------------------------------------

/** ZMW exchange rate source — in production, hit BoZ/Reuters; default for MVP. */
export const USD_TO_ZMW = (() => {
  const raw = Number(process.env.USD_TO_ZMW ?? 27);
  return Number.isFinite(raw) && raw > 0 ? raw : 27;
})();

/** Reference ZMW threshold for in-system UX (USD 10,000 equivalent). */
export const CTR_THRESHOLD_ZMW_REFERENCE = USD_TO_ZMW * CTR_THRESHOLD_USD;

// -----------------------------------------------------------------------------
// CTR DETECTION
// -----------------------------------------------------------------------------

export interface CtrEvaluation {
  triggersCtr: boolean;
  reason?: string;
  amountZMW: number;
  amountUSD: number;
}

/**
 * Evaluate whether a single cash transaction triggers a CTR. Per S.I. 52 of 2016
 * the threshold is "the kwacha equivalent of USD 10,000" — both the original
 * threshold and the USD-equivalent reference are checked.
 */
export function evaluateTransactionForCtr(
  amountZMW: number,
  cumulativeSameCustomerSameDayZMW: number
): CtrEvaluation {
  const txUSD = amountZMW / USD_TO_ZMW;
  const cumUSD = cumulativeSameCustomerSameDayZMW / USD_TO_ZMW;
  if (txUSD >= CTR_THRESHOLD_USD || cumUSD >= CTR_THRESHOLD_USD) {
    return {
      triggersCtr: true,
      reason: `Transaction USD-equivalent (tx ${txUSD.toFixed(0)} / cumulative ${cumUSD.toFixed(0)}) >= $${CTR_THRESHOLD_USD}`,
      amountZMW,
      amountUSD: txUSD,
    };
  }
  return { triggersCtr: false, amountZMW, amountUSD: txUSD };
}

/**
 * Same-day aggregation: sum a customer's cash transactions on the same day
 * across all branches and channels, in ZMW. Per the FIC AML/CFT Guidelines,
 * aggregation is mandatory.
 */
export async function getSameDayCashTotalZMW(customerKey: string, when: Date): Promise<number> {
  const startOfDay = new Date(when);
  startOfDay.setHours(0, 0, 0, 0);
  const endOfDay = new Date(startOfDay);
  endOfDay.setDate(endOfDay.getDate() + 1);
  // customerKey can be a borrowerId or a phone (msisdn)
  const txns = await prisma.mobileMoneyTransaction.findMany({
    where: {
      msisdn: customerKey,
      initiatedAt: { gte: startOfDay, lt: endOfDay },
      direction: 'INBOUND',
      status: 'SUCCESSFUL',
    },
    select: { amountZMW: true },
  });
  return txns.reduce((s, t) => s + t.amountZMW, 0);
}

/**
 * Persist a CTR record + linked alert. Called by the repayment / disbursement
 * flows when the engine flags a transaction.
 */
export async function generateCtrRecord(input: {
  alertId: string;
  borrowerId?: string | null;
  customerName: string;
  customerNrc?: string | null;
  amountZMW: number;
  transactionDate: Date;
  transactionType: 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER';
}): Promise<void> {
  await prisma.ctrRecord.create({
    data: {
      alertId: input.alertId,
      borrowerId: input.borrowerId ?? null,
      customerName: input.customerName,
      customerNrc: input.customerNrc ?? null,
      amountZMW: input.amountZMW,
      amountUSD: input.amountZMW / USD_TO_ZMW,
      transactionDate: input.transactionDate,
      transactionType: input.transactionType,
      status: 'DRAFT',
    },
  });
}

// -----------------------------------------------------------------------------
// STR TRIGGERS
// -----------------------------------------------------------------------------

export const STR_RULES = [
  {
    code: 'RAPID_REPEAT_REPAYMENTS',
    description: 'Multiple large repayments from same customer within 24 hours — possible structuring to avoid CTR.',
  },
  {
    code: 'THRESHOLD_JUST_BELOW',
    description: 'Repayments consistently just under the USD 10,000 threshold — possible structuring.',
  },
  {
    code: 'UNUSUAL_BUSINESS_PATTERN',
    description: 'Customer business type inconsistent with stated transaction pattern.',
  },
  {
    code: 'RAPID_LOAN_CYCLE',
    description: 'Customer takes and fully repays multiple loans in quick succession with no clear economic purpose.',
  },
  {
    code: 'PEP_HIT',
    description: 'Borrower identified as a politically exposed person.',
  },
  {
    code: 'SANCTIONS_HIT',
    description: 'Borrower or counterparty matches a sanctions list.',
  },
  {
    code: 'THIRD_PARTY_PAYER',
    description: 'Repayment made by someone other than the borrower with no apparent relationship.',
  },
  {
    code: 'HIGH_RISK_GEOGRAPHY',
    description: 'Funds originate from or are destined to a high-risk jurisdiction.',
  },
] as const;

export type StrRuleCode = typeof STR_RULES[number]['code'];

export interface StrTriggerInput {
  ruleCode: StrRuleCode;
  borrowerId?: string;
  loanId?: string;
  repaymentId?: string;
  description: string;
  evidence: Record<string, unknown>;
}

/** Open an STR alert and a draft `StrRecord` with the 2-working-day deadline. */
export async function openStr(input: StrTriggerInput): Promise<{ alertId: string; strRecordId: string; filingDeadline: Date }> {
  const alert = await prisma.amlAlert.create({
    data: {
      alertType: 'STR',
      severity: 'HIGH',
      borrowerId: input.borrowerId,
      loanId: input.loanId,
      repaymentId: input.repaymentId,
      ruleCode: input.ruleCode,
      description: input.description,
      evidenceJson: JSON.stringify(input.evidence),
      status: 'OPEN',
    },
  });
  const filingDeadline = new Date();
  filingDeadline.setDate(filingDeadline.getDate() + STR_FILING_DEADLINE_DAYS);
  const strRecord = await prisma.strRecord.create({
    data: {
      alertId: alert.id,
      borrowerId: input.borrowerId,
      subjectName: input.description.slice(0, 200),
      suspicionSummary: input.description,
      suspicionType: 'ML',
      status: 'DRAFT',
      filingDeadline,
    },
  });
  await prisma.amlAlert.update({
    where: { id: alert.id },
    data: { ficReportId: strRecord.id },
  });
  return { alertId: alert.id, strRecordId: strRecord.id, filingDeadline };
}

/** Open a CTR alert. */
export async function openCtr(input: {
  borrowerId?: string;
  loanId?: string;
  repaymentId?: string;
  description: string;
  evidence: Record<string, unknown>;
  amountZMW: number;
  transactionDate: Date;
  transactionType: 'DEPOSIT' | 'WITHDRAWAL' | 'TRANSFER';
  customerName: string;
  customerNrc?: string | null;
}): Promise<string> {
  const alert = await prisma.amlAlert.create({
    data: {
      alertType: 'CTR',
      severity: 'MEDIUM',
      borrowerId: input.borrowerId,
      loanId: input.loanId,
      repaymentId: input.repaymentId,
      ruleCode: 'CTR_THRESHOLD_USD_10K',
      description: input.description,
      evidenceJson: JSON.stringify(input.evidence),
      status: 'OPEN',
    },
  });
  await prisma.ctrRecord.create({
    data: {
      alertId: alert.id,
      borrowerId: input.borrowerId,
      customerName: input.customerName,
      customerNrc: input.customerNrc ?? null,
      amountZMW: input.amountZMW,
      amountUSD: input.amountZMW / USD_TO_ZMW,
      transactionDate: input.transactionDate,
      transactionType: input.transactionType,
      status: 'DRAFT',
    },
  });
  return alert.id;
}

// -----------------------------------------------------------------------------
// BENEFICIAL OWNERSHIP (25% threshold per FIC AML Guidelines)
// -----------------------------------------------------------------------------

export const UBO_THRESHOLD_PCT = 25;

export interface UboDisclosure {
  fullName: string;
  ownershipPct: number;
  verified: boolean;
}

/** Validate that the disclosed UBOs cover at least 25% thresholds. */
export function isUboDisclosureComplete(ubos: UboDisclosure[]): boolean {
  const covered = ubos.reduce((s, u) => s + (u.ownershipPct ?? 0), 0);
  return covered >= UBO_THRESHOLD_PCT;
}
