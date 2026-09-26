import { sql, eq, gt, gte, inArray, desc, and } from 'drizzle-orm';
import { db } from '@/lib/db';
import { borrowers, loans, amlAlerts, repayments } from '@/lib/db/schema';
import { getCurrentSession } from '@/lib/auth';
import Link from 'next/link';
import { formatZMW, formatPercent, formatDate } from '@/lib/utils';
import { MFI_MIN_CAR_PCT } from '@/lib/types';
import { generateCapitalAdequacyReport, generateAssetQualityReport, generateLiquidityReport } from '@/lib/boz-reports';
import { Sparkline } from '@/components/Sparkline';

export const metadata = { title: 'Dashboard — RUTHEX' };

export default async function DashboardHome() {
  const session = await getCurrentSession();
  const now = new Date();
  const periodStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const periodEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);

  // Last 30 days of daily disbursements and collections for the trend charts.
  const since30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const [borrowerCountRows, loanCountRows, activeLoansRows, openAlertsRows, capitalReport, liquidityReport, assetReport, overdueCountRows, todayRepaymentsRows, disbursedLoans30d, repayments30d] =
    await Promise.all([
      db.select({ c: sql<number>`count(*)::int` }).from(borrowers).where(eq(borrowers.status, 'ACTIVE')),
      db.select({ c: sql<number>`count(*)::int` }).from(loans),
      db.select({ c: sql<number>`count(*)::int` }).from(loans).where(inArray(loans.status, ['ACTIVE', 'IN_ARREARS', 'RESTRUCTURED'])),
      db.select({ c: sql<number>`count(*)::int` }).from(amlAlerts).where(eq(amlAlerts.status, 'OPEN')),
      Promise.resolve(generateCapitalAdequacyReport(periodStart, periodEnd)),
      Promise.resolve(generateLiquidityReport(periodStart, periodEnd)),
      Promise.resolve(generateAssetQualityReport(periodStart, periodEnd)),
      db.select({ c: sql<number>`count(*)::int` }).from(loans).where(and(gt(loans.daysInArrears, 0), inArray(loans.status, ['ACTIVE', 'IN_ARREARS', 'RESTRUCTURED']))),
      db.select({ s: sql<number>`coalesce(sum(${repayments.totalPaidZMW}), 0)::float` }).from(repayments).where(gte(repayments.receivedAt, todayStart)),
      db.select({ disbursedAt: loans.disbursedAt, principalZMW: loans.principalZMW }).from(loans).where(gte(loans.disbursedAt, since30)),
      db.select({ receivedAt: repayments.receivedAt, totalPaidZMW: repayments.totalPaidZMW }).from(repayments).where(gte(repayments.receivedAt, since30)),
    ]);

  const borrowerCount = borrowerCountRows[0]?.c ?? 0;
  const loanCount = loanCountRows[0]?.c ?? 0;
  const activeLoans = activeLoansRows[0]?.c ?? 0;
  const openAlerts = openAlertsRows[0]?.c ?? 0;
  const overdueCount = overdueCountRows[0]?.c ?? 0;
  const todayAmount = todayRepaymentsRows[0]?.s ?? 0;

  const disbursementByDay = bucketByDay(disbursedLoans30d.filter((l) => l.disbursedAt).map((l) => ({ at: l.disbursedAt!, amount: l.principalZMW })), since30, 30);
  const collectionsByDay = bucketByDay(repayments30d.map((r) => ({ at: r.receivedAt, amount: r.totalPaidZMW })), since30, 30);

  const overdueLoansRaw = await db
    .select({
      id: loans.id,
      loanNo: loans.loanNo,
      daysInArrears: loans.daysInArrears,
      totalOutstandingZMW: loans.totalOutstandingZMW,
      borrowerNo: borrowers.borrowerNo,
      firstName: borrowers.firstName,
      lastName: borrowers.lastName,
    })
    .from(loans)
    .innerJoin(borrowers, eq(loans.borrowerId, borrowers.id))
    .where(and(gt(loans.daysInArrears, 0), inArray(loans.status, ['ACTIVE', 'IN_ARREARS', 'RESTRUCTURED'])))
    .orderBy(desc(loans.daysInArrears))
    .limit(5);
  const overdueLoans = overdueLoansRaw.map((l) => ({
    id: l.id,
    loanNo: l.loanNo,
    daysInArrears: l.daysInArrears,
    totalOutstandingZMW: l.totalOutstandingZMW,
    borrower: { borrowerNo: l.borrowerNo, firstName: l.firstName, lastName: l.lastName },
  }));

  const recentAlerts = await db
    .select()
    .from(amlAlerts)
    .where(eq(amlAlerts.status, 'OPEN'))
    .orderBy(desc(amlAlerts.triggeredAt))
    .limit(5);

  const greeting = (() => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 18) return 'Good afternoon';
    return 'Good evening';
  })();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold text-slate-900">{greeting}, {session?.email.split('@')[0]}</h1>
        <p className="text-slate-500 text-sm">{formatDate(now, { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric' })} · Here is today&apos;s position at RUTHEX.</p>
      </div>

      {/* KPI grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <KpiCard label="Active borrowers" value={borrowerCount.toString()} sub="KYC approved" />
        <KpiCard label="Loans on book" value={loanCount.toString()} sub={`${activeLoans} active`} />
        <KpiCard label="Today's collections" value={formatZMW(todayAmount)} sub="Posted receipts" />
        <KpiCard label="Open AML alerts" value={openAlerts.toString()} sub={openAlerts > 0 ? 'Action required' : 'All clear'} tone={openAlerts > 0 ? 'amber' : 'green'} />
      </div>

      {/* Trend charts — last 30 days */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="card-padded">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-brand-700">Disbursements (30d)</h2>
            <Link href="/loans" className="text-xs text-brand-700 hover:underline">All loans →</Link>
          </div>
          <Sparkline values={disbursementByDay} height={70} width={320} format={(v) => formatZMW(v).replace('ZMW', 'K')} />
        </div>
        <div className="card-padded">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-bold uppercase tracking-wide text-brand-700">Collections (30d)</h2>
            <Link href="/repayments" className="text-xs text-brand-700 hover:underline">All receipts →</Link>
          </div>
          <Sparkline values={collectionsByDay} height={70} width={320} stroke="#0a8a4f" fill="rgba(10,138,79,0.10)" format={(v) => formatZMW(v).replace('ZMW', 'K')} />
        </div>
      </div>

      {/* BOZ compliance snapshot */}
      <div className="card-padded">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-bold">Bank of Zambia — prudential snapshot</h2>
          <Link href="/reports" className="text-sm text-brand-700 hover:underline">Open reports →</Link>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <MetricTile
            label="Capital adequacy ratio"
            value={formatPercent(capitalReport.capitalAdequacyRatioPct)}
            sub={`Floor for MFIs: ${MFI_MIN_CAR_PCT.toFixed(0)}%`}
            tone={capitalReport.meetsMfiFloor ? 'green' : 'red'}
          />
          <MetricTile
            label="Liquidity ratio"
            value={formatPercent(liquidityReport.liquidityRatioPct)}
            sub={`Liquid: ${formatZMW(liquidityReport.liquidAssetsZMW)}`}
            tone={liquidityReport.isCompliant ? 'green' : 'red'}
          />
          <MetricTile
            label="NPL ratio (IFRS 9 stage 3)"
            value={formatPercent(assetReport.nplRatioPct)}
            sub={`ECL provision: ${formatZMW(assetReport.eclProvisionZMW)}`}
            tone={assetReport.nplRatioPct <= 5 ? 'green' : assetReport.nplRatioPct <= 10 ? 'amber' : 'red'}
          />
        </div>
      </div>

      {/* Alerts and overdue */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card-padded">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold">Top overdue loans</h2>
            <Link href="/loans?status=OVERDUE" className="text-sm text-brand-700 hover:underline">{overdueCount} total →</Link>
          </div>
          {overdueLoans.length === 0 ? (
            <p className="text-slate-500 text-sm py-4 text-center">No loans currently overdue.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {overdueLoans.map((l) => (
                <li key={l.id} className="py-3 flex items-center justify-between">
                  <div>
                    <Link href={`/loans/${l.id}`} className="font-medium text-brand-700 hover:underline">
                      {l.borrower.firstName} {l.borrower.lastName}
                    </Link>
                    <div className="text-xs text-slate-500">{l.loanNo} · {l.borrower.borrowerNo}</div>
                  </div>
                  <div className="text-right">
                    <div className="text-sm font-semibold text-red-700">{l.daysInArrears}d</div>
                    <div className="text-xs text-slate-500">{formatZMW(l.totalOutstandingZMW)}</div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="card-padded">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-lg font-bold">Recent AML alerts</h2>
            <Link href="/aml" className="text-sm text-brand-700 hover:underline">All alerts →</Link>
          </div>
          {recentAlerts.length === 0 ? (
            <p className="text-slate-500 text-sm py-4 text-center">No open AML alerts. Compliance is clean.</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {recentAlerts.map((a) => (
                <li key={a.id} className="py-3">
                  <div className="flex items-center justify-between">
                    <span className={`badge ${a.severity === 'CRITICAL' ? 'badge-red' : a.severity === 'HIGH' ? 'badge-amber' : a.severity === 'MEDIUM' ? 'badge-blue' : 'badge-gray'}`}>
                      {a.alertType} · {a.severity}
                    </span>
                    <span className="text-xs text-slate-500">{formatDate(a.triggeredAt)}</span>
                  </div>
                  <p className="text-sm mt-1">{a.description}</p>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Innovative */}
      <div className="card-padded bg-gradient-to-br from-brand-50 to-white border-brand-200">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-brand-900">Innovation layer</h2>
            <p className="text-sm text-slate-600 mt-1">RUTHEX ships with built-in alternative-data credit scoring, USSD origination, mobile-money collection, and a PWA borrower portal — extending reach to feature-phone customers without internet.</p>
          </div>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-4">
          <Tag title="Alt-data credit score" desc="Mobile-money + utility signals" />
          <Tag title="USSD *123#" desc="Apply from any feature phone" />
          <Tag title="MTN/Airtel/Zamtel" desc="Mobile-money collection ready" />
          <Tag title="PWA borrower app" desc="Statement, repay, apply online" />
        </div>
      </div>
    </div>
  );
}

function KpiCard({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: 'green' | 'amber' | 'red' }) {
  const ring = tone === 'green' ? 'border-emerald-200 bg-emerald-50/40' : tone === 'amber' ? 'border-amber-200 bg-amber-50/40' : tone === 'red' ? 'border-red-200 bg-red-50/40' : 'border-slate-200 bg-white';
  return (
    <div className={`card-padded border ${ring}`}>
      <div className="text-xs text-slate-500 uppercase tracking-wide">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
      <div className="text-xs text-slate-500 mt-1">{sub}</div>
    </div>
  );
}

function bucketByDay(items: { at: Date; amount: number }[], since: Date, days: number): number[] {
  const today = new Date();
  const buckets: number[] = new Array(days).fill(0);
  for (const it of items) {
    const diffDays = Math.floor((today.getTime() - new Date(it.at).getTime()) / (24 * 60 * 60 * 1000));
    if (diffDays >= 0 && diffDays < days) buckets[days - 1 - diffDays] += it.amount;
  }
  // Reverse so the chart reads left-to-right as oldest → newest
  return buckets;
}

function MetricTile({ label, value, sub, tone }: { label: string; value: string; sub: string; tone?: 'green' | 'amber' | 'red' }) {
  const c = tone === 'green' ? 'text-emerald-700' : tone === 'amber' ? 'text-amber-700' : tone === 'red' ? 'text-red-700' : 'text-slate-700';
  return (
    <div className="border border-slate-200 rounded-lg p-4">
      <div className="text-xs text-slate-500 uppercase tracking-wide">{label}</div>
      <div className={`text-2xl font-bold mt-1 ${c}`}>{value}</div>
      <div className="text-xs text-slate-500 mt-1">{sub}</div>
    </div>
  );
}

function Tag({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="bg-white border border-brand-200 rounded p-3 text-sm">
      <div className="font-semibold text-brand-800">{title}</div>
      <div className="text-xs text-slate-500 mt-1">{desc}</div>
    </div>
  );
}
