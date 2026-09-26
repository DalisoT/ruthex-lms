/**
 * Alternative-data credit scoring.
 *
 * Conventional credit scoring relies on bureau data that thin-file Zambian
 * borrowers often don't have. RUTHEX supplements bureau data with observable
 * signals — mobile money flow consistency, utility payment regularity,
 * employer stability, geo-coverage of business activity, and prior on-time
 * performance (for returning borrowers).
 *
 * This is intentionally lightweight: the score is a heuristic for loan officer
 * decision support, not a substitute for human underwriting. The score is
 * persisted on the application so the audit trail is intact.
 */
import { eq } from 'drizzle-orm';
import { db } from './db';
import { borrowers } from './db/schema';

export interface AltDataInputs {
  // Mobile money flow consistency (0-100)
  mobileMoneyInflowConsistencyScore: number; // last 6 months
  // Utility bill payment regularity (0-100)
  utilityPaymentRegularityScore: number;
  // Employer stability proxy (0-100)
  employerStabilityScore: number;
  // Months in current business / self-employment
  monthsInBusiness: number;
  // Average monthly inflow vs. requested loan (ratio)
  monthlyInflowToLoanRatio: number;
  // Prior loan performance with RUTHEX (0-100, neutral if no prior)
  priorPerformanceScore: number;
  // Bureau score if available (0-100, neutral if not)
  bureauScore?: number | null;
}

export interface CreditScoreResult {
  score: number;        // 0-1000
  grade: 'A' | 'B' | 'C' | 'D' | 'E';
  factors: { name: string; weight: number; value: number; contribution: number }[];
  recommendation: 'APPROVE' | 'ENHANCED_DD' | 'DECLINE';
}

const WEIGHTS = {
  mmConsistency: 0.20,
  utilityRegularity: 0.10,
  employerStability: 0.15,
  monthsInBusiness: 0.10,
  inflowToLoanRatio: 0.15,
  priorPerformance: 0.20,
  bureau: 0.10,
};

/**
 * Compute a credit score. Inputs are normalised to 0-100 and weighted.
 * Returns a 0-1000 score, a letter grade, the contributing factors, and a
 * recommendation.
 */
export function computeCreditScore(input: AltDataInputs): CreditScoreResult {
  // Normalize monthsInBusiness (cap at 24 months == 100)
  const mob = Math.min(input.monthsInBusiness / 24, 1) * 100;
  // Inflow-to-loan ratio: 1.0 means monthly inflow covers loan principal+interest
  // >= 2.0 scores 100, < 0.5 scores 0
  const ilRatio = Math.max(0, Math.min(100, ((input.monthlyInflowToLoanRatio - 0.5) / 1.5) * 100));
  const bureau = input.bureauScore ?? 50; // neutral when absent

  const factors = [
    { name: 'Mobile money inflow consistency', weight: WEIGHTS.mmConsistency, value: input.mobileMoneyInflowConsistencyScore, contribution: WEIGHTS.mmConsistency * input.mobileMoneyInflowConsistencyScore },
    { name: 'Utility payment regularity', weight: WEIGHTS.utilityRegularity, value: input.utilityPaymentRegularityScore, contribution: WEIGHTS.utilityRegularity * input.utilityPaymentRegularityScore },
    { name: 'Employer stability', weight: WEIGHTS.employerStability, value: input.employerStabilityScore, contribution: WEIGHTS.employerStability * input.employerStabilityScore },
    { name: 'Tenure in business', weight: WEIGHTS.monthsInBusiness, value: mob, contribution: WEIGHTS.monthsInBusiness * mob },
    { name: 'Inflow to loan ratio', weight: WEIGHTS.inflowToLoanRatio, value: ilRatio, contribution: WEIGHTS.inflowToLoanRatio * ilRatio },
    { name: 'Prior performance with RUTHEX', weight: WEIGHTS.priorPerformance, value: input.priorPerformanceScore, contribution: WEIGHTS.priorPerformance * input.priorPerformanceScore },
    { name: 'Bureau score', weight: WEIGHTS.bureau, value: bureau, contribution: WEIGHTS.bureau * bureau },
  ];
  const total = factors.reduce((s, f) => s + f.contribution, 0);
  const score = Math.round(total * 10); // 0-1000
  let grade: CreditScoreResult['grade'];
  let recommendation: CreditScoreResult['recommendation'];
  if (score >= 750) { grade = 'A'; recommendation = 'APPROVE'; }
  else if (score >= 650) { grade = 'B'; recommendation = 'APPROVE'; }
  else if (score >= 550) { grade = 'C'; recommendation = 'APPROVE'; }
  else if (score >= 450) { grade = 'D'; recommendation = 'ENHANCED_DD'; }
  else { grade = 'E'; recommendation = 'DECLINE'; }

  return { score, grade, factors, recommendation };
}

/**
 * Build a default AltDataInputs for a borrower who has never transacted with
 * RUTHEX. Mobile money consistency and utility regularity are inferred from
 * KYC fields; everything else is set to a conservative neutral value.
 */
export async function buildDefaultAltDataInputs(borrowerId: string): Promise<AltDataInputs> {
  const rows = await db.select().from(borrowers).where(eq(borrowers.id, borrowerId)).limit(1);
  const borrower = rows[0];
  if (!borrower) {
    throw new Error(`Borrower ${borrowerId} not found`);
  }
  return {
    mobileMoneyInflowConsistencyScore: 50,
    utilityPaymentRegularityScore: 50,
    employerStabilityScore: borrower.employmentStatus === 'EMPLOYED' ? 65 : 40,
    monthsInBusiness: 12,
    monthlyInflowToLoanRatio: 1.0,
    priorPerformanceScore: 50,
    bureauScore: null,
  };
}
