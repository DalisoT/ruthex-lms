import { sql, eq, desc, asc, and, or, inArray, ne, gte, lte, gt, lt, isNull, like, ilike } from 'drizzle-orm';
import { db, prisma } from '@/lib/db';
import { borrowers, loans, repayments, amlAlerts, auditLogs, users, branches, loanApplications, loanProducts, notifications } from '@/lib/db/schema';

import { generateCapitalAdequacyReport, generateLiquidityReport, generateAssetQualityReport, generateLargeExposuresReport, generateRelatedPartyReport, snapshotBozReport, zmw } from '@/lib/boz-reports';
import { formatPercent, formatDate } from '@/lib/utils';
import { MFI_MIN_CAR_PCT } from '@/lib/types';
import Link from 'next/link';
import SnapshotButton from './SnapshotButton';

export const metadata = { title: 'BOZ Reports — RUTHEX' };

export default async function ReportsPage() {
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  const [cap, liq, aq, lge, rpe, snapshots] = await Promise.all([
    generateCapitalAdequacyReport(periodStart, periodEnd),
    generateLiquidityReport(periodStart, periodEnd),
    generateAssetQualityReport(periodStart, periodEnd),
    generateLargeExposuresReport(periodStart, periodEnd),
    generateRelatedPartyReport(periodStart, periodEnd),
    prisma.bozReport.findMany({ orderBy: { generatedAt: 'desc' }, take: 10 }),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Bank of Zambia — prudential reports</h1>
        <p className="text-sm text-slate-500">Period: {formatDate(periodStart)} – {formatDate(periodEnd)}. Snapshot persists the figures for BOZ submission audit.</p>
      </div>

      <SnapshotButton
        reports={[
          { type: 'CAPITAL_ADEQUACY' as const, payload: cap as any },
          { type: 'LIQUIDITY' as const, payload: liq as any },
          { type: 'ASSET_QUALITY' as const, payload: aq as any },
          { type: 'LARGE_EXPOSURES' as const, payload: lge as any },
          { type: 'RELATED_PARTY' as const, payload: rpe as any },
        ]}
        periodStart={periodStart.toISOString()}
        periodEnd={periodEnd.toISOString()}
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ReportCard
          title="Capital adequacy (CAR)"
          compliance={cap.meetsMfiFloor ? 'pass' : 'fail'}
          rows={[
            ['Paid-up capital', zmw(cap.paidUpCapitalZMW)],
            ['Retained earnings + reserves', zmw(cap.retainedEarningsZMW + cap.reservesZMW)],
            ['Total regulatory capital', zmw(cap.totalRegulatoryCapitalZMW)],
            ['Total risk-weighted assets', zmw(cap.totalRWAZMW)],
            ['Capital adequacy ratio', `${cap.capitalAdequacyRatioPct.toFixed(2)}%`],
            ['MFI floor (per SI 62/2025)', `${MFI_MIN_CAR_PCT.toFixed(0)}%`],
            ['Loans on book', zmw(cap.loansToBorrowersZMW)],
          ]}
        />

        <ReportCard
          title="Liquidity ratio"
          compliance={liq.isCompliant ? 'pass' : 'fail'}
          rows={[
            ['Liquid assets (cash + bank + govt sec)', zmw(liq.liquidAssetsZMW)],
            ['Total liabilities (loan book)', zmw(liq.totalLiabilitiesZMW)],
            ['Liquidity ratio', `${liq.liquidityRatioPct.toFixed(2)}%`],
            ['Minimum threshold', '20.00%'],
          ]}
        />

        <ReportCard
          title="Asset quality (NPL)"
          compliance={aq.nplRatioPct <= 5 ? 'pass' : aq.nplRatioPct <= 10 ? 'warn' : 'fail'}
          rows={[
            ['Total loans outstanding', zmw(aq.totalLoansOutstandingZMW)],
            ['NPL (IFRS 9 stage 3)', zmw(aq.nplLoansZMW)],
            ['NPL ratio', `${aq.nplRatioPct.toFixed(2)}%`],
            ['Stage 1 (performing)', zmw(aq.stage1LoansZMW)],
            ['Stage 2 (watch)', zmw(aq.stage2LoansZMW)],
            ['Stage 3 (NPL)', zmw(aq.stage3LoansZMW)],
            ['ECL provision', zmw(aq.eclProvisionZMW)],
            ['0–30 days past due', `${aq.bucket0to30} loans`],
            ['31–60 days past due', `${aq.bucket31to60} loans`],
            ['61–90 days past due', `${aq.bucket61to90} loans`],
            ['91+ days past due', `${aq.bucket91Plus} loans`],
          ]}
        />

        <ReportCard
          title="Large exposures (single counterparty)"
          compliance={lge.breaches.length === 0 ? 'pass' : 'fail'}
          rows={[
            ['Total capital', zmw(lge.totalCapitalZMW)],
            ['Single counterparty limit', `${lge.limitPct}%`],
            ['Borrowers over 5% of capital', `${lge.largeExposures.length}`],
            ['Breaches', `${lge.breaches.length}`],
          ]}
          subTable={lge.largeExposures.slice(0, 10).map((e: any) => [
            e.borrowerNo,
            e.borrowerName,
            zmw(e.exposureZMW),
            `${e.pctOfCapital.toFixed(1)}%`,
          ])}
        />

        <ReportCard
          title="Related-party exposures"
          compliance={rpe.isCompliant ? 'pass' : 'fail'}
          rows={[
            ['Total regulatory capital', zmw(rpe.totalRegulatoryCapitalZMW)],
            ['Aggregate limit', `${rpe.limitPct}%`],
            ['Related-party exposures on book', `${rpe.exposures.length}`],
            ['Compliance status', rpe.isCompliant ? 'Within limit' : 'Breach'],
          ]}
          subTable={rpe.exposures.slice(0, 10).map((e: any) => [
            e.name,
            e.relationship,
            zmw(e.exposureZMW),
            `${e.pctOfCapital.toFixed(1)}%`,
          ])}
        />
      </div>

      <div className="card overflow-x-auto">
        <div className="px-6 py-4 border-b"><h2 className="font-bold">Recent BOZ snapshots</h2></div>
        {snapshots.length === 0 ? (
          <div className="px-6 py-6 text-sm text-slate-500">No snapshots generated yet. Click "Snapshot this period" above to persist figures.</div>
        ) : (
          <table className="table-base responsive-table">
            <thead>
              <tr>
                <th>Type</th><th>Period</th><th>CAR</th><th>Generated</th><th>Status</th>
              </tr>
            </thead>
            <tbody>
              {snapshots.map((s: any) => (
                <tr key={s.id}>
                  <td className="text-xs font-medium">{s.reportType.replace(/_/g, ' ')}</td>
                  <td className="text-xs">{formatDate(s.periodStart)} – {formatDate(s.periodEnd)}</td>
                  <td className="text-xs">{s.capitalAdequacyRatio != null ? `${s.capitalAdequacyRatio.toFixed(2)}%` : '—'}</td>
                  <td className="text-xs">{formatDate(s.generatedAt)}</td>
                  <td><span className={`badge ${s.status === 'SUBMITTED' ? 'badge-green' : s.status === 'ACKNOWLEDGED' ? 'badge-blue' : 'badge-gray'}`}>{s.status}</span></td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function ReportCard({
  title, rows, compliance, subTable,
}: {
  title: string; rows: [string, string][]; compliance?: 'pass' | 'warn' | 'fail';
  subTable?: string[][];
}) {
  const dot = compliance === 'pass' ? 'bg-emerald-500' : compliance === 'warn' ? 'bg-amber-500' : compliance === 'fail' ? 'bg-red-500' : 'bg-slate-300';
  return (
    <div className="card-padded">
      <div className="flex items-center justify-between mb-3">
        <h2 className="font-bold">{title}</h2>
        {compliance && (
          <span className="inline-flex items-center gap-2 text-xs">
            <span className={`inline-block w-2 h-2 rounded-full ${dot}`} />
            {compliance.toUpperCase()}
          </span>
        )}
      </div>
      <dl className="text-sm space-y-1">
        {rows.map(([k, v]) => (
          <div key={k} className="flex justify-between gap-3 border-b border-slate-100 pb-1">
            <dt className="text-slate-500">{k}</dt>
            <dd className="font-medium text-right">{v}</dd>
          </div>
        ))}
      </dl>
      {subTable && subTable.length > 0 && (
        <div className="mt-3">
          <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Top exposures</div>
          <table className="text-xs w-full">
            <thead className="text-slate-500">
              <tr>
                <th className="text-left py-1">Ref</th>
                <th className="text-left py-1">Name</th>
                <th className="text-right py-1">Amount</th>
                <th className="text-right py-1">% of cap</th>
              </tr>
            </thead>
            <tbody>
              {subTable.map((row, i) => (
                <tr key={i} className="border-t border-slate-100">
                  <td className="font-mono py-1">{row[0]}</td>
                  <td className="py-1">{row[1]}</td>
                  <td className="text-right py-1">{row[2]}</td>
                  <td className="text-right py-1">{row[3]}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
