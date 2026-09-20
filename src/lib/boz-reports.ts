/**
 * BOZ prudential reporting — generating the monthly return templates.
 *
 * Implements the spirit of the Capital Adequacy Rules (S.I. 62 of 2025) and
 * the prudential reporting formats Bank of Zambia expects from NBFIs:
 *   - Capital adequacy (CAR) at the 15% floor for MFIs
 *   - Liquidity ratio
 *   - Asset quality (NPL ratio, IFRS 9 staging breakdown)
 *   - Large exposures (concentration)
 *   - Related-party exposures
 *
 * These reports can be previewed in the dashboard and exported as PDF/CSV.
 * In production, the snapshot can be submitted to BOZ through the supervisory
 * portal (file format governed by BOZ directives).
 */
import { prisma } from './db';
import crypto from 'crypto';
import { MFI_MIN_CAR_PCT } from './types';

// -----------------------------------------------------------------------------
// HELPERS
// -----------------------------------------------------------------------------

export function zmw(value: number): string {
  return new Intl.NumberFormat('en-ZM', {
    style: 'currency',
    currency: 'ZMW',
    maximumFractionDigits: 2,
  }).format(value);
}

function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

// -----------------------------------------------------------------------------
// CAPITAL ADEQUACY
// -----------------------------------------------------------------------------

export interface CapitalAdequacyReport {
  periodStart: Date;
  periodEnd: Date;
  // Capital components
  paidUpCapitalZMW: number;
  retainedEarningsZMW: number;
  reservesZMW: number;
  totalTier1ZMW: number;
  totalSecondaryCapitalZMW: number;
  totalRegulatoryCapitalZMW: number;
  // Risk-weighted assets breakdown
  cashAndBankZMW: number;
  governmentSecuritiesZMW: number;
  loansToBorrowersZMW: number;
  fixedAssetsZMW: number;
  otherAssetsZMW: number;
  totalRWAZMW: number;
  // Ratios
  capitalAdequacyRatioPct: number;
  meetsMfiFloor: boolean;
  // Memo
  nplStageBreakdown: { stage1: number; stage2: number; stage3: number };
}

export async function generateCapitalAdequacyReport(periodStart: Date, periodEnd: Date): Promise<CapitalAdequacyReport> {
  const loans = await prisma.loan.findMany({
    where: { status: { in: ['ACTIVE', 'IN_ARREARS', 'RESTRUCTURED', 'DEFAULTED'] } },
    select: { principalOutstandingZMW: true, ifrs9Stage: true },
  });
  const totalLoans = loans.reduce((s, l) => s + l.principalOutstandingZMW, 0);
  // Simplified RWA weighting
  const rwaLoans = totalLoans * 1.0;     // 100% risk weight for borrower loans
  const rwaCash = 0;                    // 0% risk weight for cash
  const rwaGovSec = 0;                 // 0% for government securities
  const rwaFixedAssets = 100_000 * 1.0;
  const rwaOther = 50_000;
  const totalRWA = rwaLoans + rwaFixedAssets + rwaOther;

  // Regulatory capital = paid-up + retained earnings + reserves (simplified)
  const paidUp = 100_000; // NDT MFI minimum; production: actual capital from books
  const retained = 0;
  const reserves = 0;
  const totalRegulatoryCapital = paidUp + retained + reserves;
  const carPct = totalRWA > 0 ? (totalRegulatoryCapital / totalRWA) * 100 : 0;

  const stageBreakdown = {
    stage1: loans.filter((l) => l.ifrs9Stage === 1).length,
    stage2: loans.filter((l) => l.ifrs9Stage === 2).length,
    stage3: loans.filter((l) => l.ifrs9Stage === 3).length,
  };

  return {
    periodStart,
    periodEnd,
    paidUpCapitalZMW: paidUp,
    retainedEarningsZMW: retained,
    reservesZMW: reserves,
    totalTier1ZMW: paidUp + retained + reserves,
    totalSecondaryCapitalZMW: 0,
    totalRegulatoryCapitalZMW: totalRegulatoryCapital,
    cashAndBankZMW: 0,
    governmentSecuritiesZMW: 0,
    loansToBorrowersZMW: totalLoans,
    fixedAssetsZMW: 100_000,
    otherAssetsZMW: 50_000,
    totalRWAZMW: totalRWA,
    capitalAdequacyRatioPct: Number(carPct.toFixed(2)),
    meetsMfiFloor: carPct >= MFI_MIN_CAR_PCT,
    nplStageBreakdown: stageBreakdown,
  };
}

// -----------------------------------------------------------------------------
// LIQUIDITY
// -----------------------------------------------------------------------------

export interface LiquidityReport {
  periodStart: Date;
  periodEnd: Date;
  liquidAssetsZMW: number;        // cash + bank + govt securities
  totalLiabilitiesZMW: number;    // deposits + borrowings
  liquidityRatioPct: number;
  isCompliant: boolean;            // simple pass if ratio >= 20%
}

export async function generateLiquidityReport(periodStart: Date, periodEnd: Date): Promise<LiquidityReport> {
  const loans = await prisma.loan.findMany({
    where: { status: { in: ['ACTIVE', 'IN_ARREARS', 'RESTRUCTURED'] } },
    select: { totalOutstandingZMW: true },
  });
  const liabilities = loans.reduce((s, l) => s + l.totalOutstandingZMW, 0);
  // Liquidity: cash + bank balance — simplified, placeholders for production
  const liquidAssets = 250_000;
  const ratio = liabilities > 0 ? (liquidAssets / liabilities) * 100 : 100;
  return {
    periodStart,
    periodEnd,
    liquidAssetsZMW: liquidAssets,
    totalLiabilitiesZMW: liabilities,
    liquidityRatioPct: Number(ratio.toFixed(2)),
    isCompliant: ratio >= 20,
  };
}

// -----------------------------------------------------------------------------
// ASSET QUALITY (NPL ratio)
// -----------------------------------------------------------------------------

export interface AssetQualityReport {
  periodStart: Date;
  periodEnd: Date;
  totalLoansOutstandingZMW: number;
  nplLoansZMW: number;
  nplRatioPct: number;
  // IFRS 9 stage breakdown
  stage1LoansZMW: number;
  stage2LoansZMW: number;
  stage3LoansZMW: number;
  eclProvisionZMW: number;
  // Delinquency buckets
  bucket0to30: number;
  bucket31to60: number;
  bucket61to90: number;
  bucket91Plus: number;
}

export async function generateAssetQualityReport(periodStart: Date, periodEnd: Date): Promise<AssetQualityReport> {
  const loans = await prisma.loan.findMany({
    where: { status: { in: ['ACTIVE', 'IN_ARREARS', 'RESTRUCTURED', 'DEFAULTED'] } },
    select: { principalOutstandingZMW: true, ifrs9Stage: true, daysInArrears: true, eclProvisionZMW: true },
  });
  const totalOutstanding = loans.reduce((s, l) => s + l.principalOutstandingZMW, 0);
  const stage1 = loans.filter((l) => l.ifrs9Stage === 1).reduce((s, l) => s + l.principalOutstandingZMW, 0);
  const stage2 = loans.filter((l) => l.ifrs9Stage === 2).reduce((s, l) => s + l.principalOutstandingZMW, 0);
  const stage3 = loans.filter((l) => l.ifrs9Stage === 3).reduce((s, l) => s + l.principalOutstandingZMW, 0);
  const nplLoans = stage3;
  const nplRatio = totalOutstanding > 0 ? (nplLoans / totalOutstanding) * 100 : 0;
  const ecl = loans.reduce((s, l) => s + l.eclProvisionZMW, 0);
  const bucket0to30 = loans.filter((l) => l.daysInArrears > 0 && l.daysInArrears <= 30).length;
  const bucket31to60 = loans.filter((l) => l.daysInArrears > 30 && l.daysInArrears <= 60).length;
  const bucket61to90 = loans.filter((l) => l.daysInArrears > 60 && l.daysInArrears <= 90).length;
  const bucket91Plus = loans.filter((l) => l.daysInArrears > 90).length;

  return {
    periodStart,
    periodEnd,
    totalLoansOutstandingZMW: totalOutstanding,
    nplLoansZMW: nplLoans,
    nplRatioPct: Number(nplRatio.toFixed(2)),
    stage1LoansZMW: stage1,
    stage2LoansZMW: stage2,
    stage3LoansZMW: stage3,
    eclProvisionZMW: ecl,
    bucket0to30,
    bucket31to60,
    bucket61to90,
    bucket91Plus,
  };
}

// -----------------------------------------------------------------------------
// LARGE EXPOSURES (concentration)
// -----------------------------------------------------------------------------

export interface LargeExposure {
  borrowerId: string;
  borrowerNo: string;
  borrowerName: string;
  exposureZMW: number;
  pctOfCapital: number;
}

export interface LargeExposuresReport {
  periodStart: Date;
  periodEnd: Date;
  totalCapitalZMW: number;
  largeExposures: LargeExposure[];
  breaches: LargeExposure[];
  limitPct: number; // typically 25% of capital per single counterparty
}

export async function generateLargeExposuresReport(periodStart: Date, periodEnd: Date): Promise<LargeExposuresReport> {
  const capital = 100_000; // simplified; production: actual regulatory capital
  const loans = await prisma.loan.findMany({
    where: { status: { in: ['ACTIVE', 'IN_ARREARS', 'RESTRUCTURED'] } },
    include: { borrower: { select: { id: true, borrowerNo: true, firstName: true, lastName: true } } },
  });
  const byBorrower = new Map<string, { exposure: number; info: any }>();
  for (const l of loans) {
    const acc = byBorrower.get(l.borrowerId) ?? { exposure: 0, info: l.borrower };
    acc.exposure += l.principalOutstandingZMW;
    byBorrower.set(l.borrowerId, acc);
  }
  const exposures: LargeExposure[] = Array.from(byBorrower.entries())
    .map(([id, v]) => ({
      borrowerId: id,
      borrowerNo: v.info.borrowerNo,
      borrowerName: `${v.info.firstName} ${v.info.lastName}`,
      exposureZMW: v.exposure,
      pctOfCapital: capital > 0 ? (v.exposure / capital) * 100 : 0,
    }))
    .filter((e) => e.pctOfCapital >= 5) // only meaningful exposures
    .sort((a, b) => b.exposureZMW - a.exposureZMW);
  const limitPct = 25;
  const breaches = exposures.filter((e) => e.pctOfCapital > limitPct);
  return {
    periodStart,
    periodEnd,
    totalCapitalZMW: capital,
    largeExposures: exposures,
    breaches,
    limitPct,
  };
}

// -----------------------------------------------------------------------------
// RELATED-PARTY EXPOSURES
// -----------------------------------------------------------------------------

export interface RelatedPartyExposureReport {
  periodStart: Date;
  periodEnd: Date;
  totalRegulatoryCapitalZMW: number;
  exposures: { name: string; relationship: string; exposureZMW: number; pctOfCapital: number }[];
  isCompliant: boolean; // total related-party exposures <= 20% of capital
  limitPct: number;
}

export async function generateRelatedPartyReport(periodStart: Date, periodEnd: Date): Promise<RelatedPartyExposureReport> {
  // Related party = a director, officer, or their close family
  // For MVP, treat any borrower whose assigned officer is also a borrower as related
  const users = await prisma.user.findMany({
    select: { id: true, fullName: true, role: true },
  });
  const userIds = new Set(users.map((u) => u.id));
  const relatedBorrowers = await prisma.borrower.findMany({
    where: { assignedOfficerId: { in: Array.from(userIds) } },
    select: { id: true, firstName: true, lastName: true, assignedOfficerId: true },
  });
  const officerNameByUser = new Map(users.map((u) => [u.id, u.fullName]));
  const capital = 100_000;
  const exposures: { name: string; relationship: string; exposureZMW: number; pctOfCapital: number }[] = [];
  for (const b of relatedBorrowers) {
    const loans = await prisma.loan.findMany({
      where: { borrowerId: b.id, status: { in: ['ACTIVE', 'IN_ARREARS', 'RESTRUCTURED'] } },
      select: { principalOutstandingZMW: true },
    });
    const total = loans.reduce((s, l) => s + l.principalOutstandingZMW, 0);
    if (total > 0 && b.assignedOfficerId) {
      exposures.push({
        name: `${b.firstName} ${b.lastName}`,
        relationship: `Customer of officer ${officerNameByUser.get(b.assignedOfficerId) ?? b.assignedOfficerId}`,
        exposureZMW: total,
        pctOfCapital: capital > 0 ? (total / capital) * 100 : 0,
      });
    }
  }
  const totalRelated = exposures.reduce((s, e) => s + e.exposureZMW, 0);
  const totalPct = capital > 0 ? (totalRelated / capital) * 100 : 0;
  return {
    periodStart,
    periodEnd,
    totalRegulatoryCapitalZMW: capital,
    exposures,
    isCompliant: totalPct <= 20,
    limitPct: 20,
  };
}

// -----------------------------------------------------------------------------
// SNAPSHOT — persist a full BOZ report
// -----------------------------------------------------------------------------

export async function snapshotBozReport(
  reportType: 'CAPITAL_ADEQUACY' | 'LIQUIDITY' | 'ASSET_QUALITY' | 'LARGE_EXPOSURES' | 'RELATED_PARTY' | 'MONTHLY_PRUDENTIAL',
  periodStart: Date,
  periodEnd: Date,
  payload: Record<string, unknown>,
  generatedById: string
): Promise<string> {
  const json = JSON.stringify(payload, null, 2);
  const report = await prisma.bozReport.create({
    data: {
      reportType,
      periodStart,
      periodEnd,
      payloadJson: json,
      payloadSha256: sha256(json),
      status: 'DRAFT',
      generatedById,
      totalCapitalZMW: typeof payload.totalRegulatoryCapitalZMW === 'number' ? payload.totalRegulatoryCapitalZMW as number : null,
      totalRiskWeightedAssetsZMW: typeof payload.totalRWAZMW === 'number' ? payload.totalRWAZMW as number : null,
      capitalAdequacyRatio: typeof payload.capitalAdequacyRatioPct === 'number' ? payload.capitalAdequacyRatioPct as number : null,
      liquidAssetsZMW: typeof payload.liquidAssetsZMW === 'number' ? payload.liquidAssetsZMW as number : null,
      liquidityRatio: typeof payload.liquidityRatioPct === 'number' ? payload.liquidityRatioPct as number : null,
      nplRatio: typeof payload.nplRatioPct === 'number' ? payload.nplRatioPct as number : null,
    },
  });
  return report.id;
}
