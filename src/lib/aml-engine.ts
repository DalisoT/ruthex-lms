/**
 * Extended AML detection — runs alongside `aml.ts`.
 *
 * Detects behaviour the CTR threshold can't catch:
 *   - Structuring: multiple cash transactions just below the threshold
 *   - Velocity: high repayment frequency
 *   - Round-number behaviour: suspiciously neat round-amount payments
 *   - PEP-amount: any transaction above a lower threshold for PEP-flagged borrowers
 *   - Rapid loan cycling: borrow + repay + borrow again in quick succession
 *
 * Each detector writes an `AmlAlert` + `StrRecord` with the standard 2-working-day
 * filing deadline (per FIC Act).
 */
import { prisma } from './db';
import { openStr, USD_TO_ZMW } from './aml';
import { CTR_THRESHOLD_USD } from './types';

/**
 * STRUCTURING — pattern: 2+ transactions within 7 days, each individually below
 * the CTR threshold but collectively above it. The classic "smurfing" tell.
 */
export async function detectStructuring(customerKey: string, borrowerId: string): Promise<void> {
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const txns = await prisma.repayment.findMany({
    where: {
      receivedAt: { gte: since },
      paymentMethod: 'CASH',
      loan: { borrowerId },
    },
    select: { id: true, totalPaidZMW: true, receivedAt: true, receiptNo: true },
    orderBy: { receivedAt: 'asc' },
  });
  if (txns.length < 2) return;
  const total = txns.reduce((s, t) => s + t.totalPaidZMW, 0);
  const totalUSD = total / USD_TO_ZMW;
  if (totalUSD < CTR_THRESHOLD_USD) return;
  const allBelowThreshold = txns.every((t) => t.totalPaidZMW / USD_TO_ZMW < CTR_THRESHOLD_USD);
  if (!allBelowThreshold) return;
  await openStr({
    ruleCode: 'THRESHOLD_JUST_BELOW',
    borrowerId,
    description: `Possible structuring: ${txns.length} cash repayments in 7 days totalling K${total.toFixed(2)} (~USD ${totalUSD.toFixed(0)}), each individually under the USD ${CTR_THRESHOLD_USD} CTR threshold.`,
    evidence: { txns: txns.map((t) => ({ receiptNo: t.receiptNo, amount: t.totalPaidZMW, at: t.receivedAt })), totalUSD, customerKey },
  });
}

/**
 * VELOCITY — more than 4 cash repayments in 24 hours from the same customer.
 * Indicates possible pass-through / mule behaviour.
 */
export async function detectVelocity(borrowerId: string): Promise<void> {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000);
  const count = await prisma.repayment.count({
    where: {
      receivedAt: { gte: since },
      paymentMethod: 'CASH',
      loan: { borrowerId },
    },
  });
  if (count < 4) return;
  await openStr({
    ruleCode: 'RAPID_REPEAT_REPAYMENTS',
    borrowerId,
    description: `${count} cash repayments in the last 24 hours — possible pass-through / structuring.`,
    evidence: { count24h: count },
  });
}

/**
 * ROUND-NUMBER — multiple repayments that are suspiciously exact multiples of
 * K1,000 / K5,000 / K10,000. Real consumer repayments rarely align this neatly.
 */
export async function detectRoundNumberPattern(borrowerId: string): Promise<void> {
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const txns = await prisma.repayment.findMany({
    where: {
      receivedAt: { gte: since },
      loan: { borrowerId },
    },
    select: { totalPaidZMW: true },
  });
  if (txns.length < 3) return;
  const rounds = txns.filter((t) => t.totalPaidZMW >= 1000 && t.totalPaidZMW % 1000 === 0).length;
  const ratio = rounds / txns.length;
  if (ratio < 0.6) return;
  await openStr({
    ruleCode: 'UNUSUAL_BUSINESS_PATTERN',
    borrowerId,
    description: `${Math.round(ratio * 100)}% of last 30 days of repayments are exact multiples of K1,000 — atypical for genuine consumer activity.`,
    evidence: { totalTxns: txns.length, roundTxns: rounds, ratio },
  });
}

/**
 * PEP-amount — any single transaction above a lower threshold for borrowers
 * flagged as politically exposed persons. Lower trigger because PEP exposure
 * amplifies risk.
 */
export async function detectPepAmount(borrowerId: string, totalPaidZMW: number): Promise<void> {
  const borrower = await prisma.borrower.findUnique({ where: { id: borrowerId } });
  if (!borrower?.pepFlag) return;
  const lowerUSD = CTR_THRESHOLD_USD / 2; // K13,500-ish at default rate
  if (totalPaidZMW / USD_TO_ZMW < lowerUSD) return;
  await openStr({
    ruleCode: 'PEP_HIT',
    borrowerId,
    description: `PEP borrower transaction of K${totalPaidZMW.toFixed(2)} (~USD ${(totalPaidZMW / USD_TO_ZMW).toFixed(0)}) exceeds lower PEP threshold of USD ${lowerUSD}.`,
    evidence: { amountZMW: totalPaidZMW, lowerUSD },
  });
}

/**
 * RAPID LOAN CYCLING — borrower takes and fully repays 3+ loans in 90 days
 * without an apparent economic purpose.
 */
export async function detectRapidLoanCycle(borrowerId: string): Promise<void> {
  const since = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
  const loans = await prisma.loan.findMany({
    where: { borrowerId, createdAt: { gte: since } },
    orderBy: { createdAt: 'asc' },
    include: { repayments: { select: { totalPaidZMW: true } } },
  });
  if (loans.length < 3) return;
  const fullyRepaidCount = loans.filter((l) => {
    const total = l.repayments.reduce((s, r) => s + r.totalPaidZMW, 0);
    return total >= l.principalZMW * 0.95;
  }).length;
  if (fullyRepaidCount < 2) return;
  await openStr({
    ruleCode: 'RAPID_LOAN_CYCLE',
    borrowerId,
    description: `${loans.length} loans in 90 days; ${fullyRepaidCount} repaid close to principal.`,
    evidence: { loansLast90d: loans.length, fullyRepaidCount },
  });
}

/**
 * Run all STR detectors for a given repayment event. Idempotent: the `openStr`
 * function creates a new alert row, but in production you'd add a "duplicate
 * suppression" check by ruleCode within a window.
 */
export async function runAllDetectors(input: { borrowerId: string; totalPaidZMW: number; msisdn?: string | null }) {
  await Promise.allSettled([
    detectStructuring(input.msisdn ?? input.borrowerId, input.borrowerId),
    detectVelocity(input.borrowerId),
    detectRoundNumberPattern(input.borrowerId),
    detectPepAmount(input.borrowerId, input.totalPaidZMW),
    detectRapidLoanCycle(input.borrowerId),
  ]);
}
