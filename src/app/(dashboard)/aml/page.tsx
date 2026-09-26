import { sql, eq, desc, asc, and, or, inArray, ne, gte, lte, gt, lt, isNull, like, ilike } from 'drizzle-orm';
import { db, prisma } from '@/lib/db';
import { borrowers, loans, repayments, amlAlerts, auditLogs, users, branches, loanApplications, loanProducts, notifications } from '@/lib/db/schema';

import Link from 'next/link';
import { formatDate, formatZMW } from '@/lib/utils';

export const metadata = { title: 'AML Alerts — RUTHEX' };

export default async function AmlAlertsPage({ searchParams }: { searchParams: { status?: string; type?: string } }) {
  const status = searchParams.status ?? 'OPEN';
  const type = searchParams.type;
  const where = {
    AND: [
      status ? { status: status as any } : {},
      type ? { alertType: type } : {},
    ],
  };
  const alerts = await prisma.amlAlert.findMany({
    where,
    include: { borrower: { select: { firstName: true, lastName: true, borrowerNo: true } } },
    orderBy: { triggeredAt: 'desc' },
    take: 200,
  });
  const counts = await prisma.amlAlert.groupBy({
    by: ['alertType', 'status'],
    _count: { _all: true },
  });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">AML alerts</h1>
        <p className="text-sm text-slate-500">CTR auto-flags cash transactions at the USD 10,000 equivalent threshold. STRs are opened by the rule engine for review.</p>
      </div>

      <div className="card p-4 grid grid-cols-2 md:grid-cols-5 gap-4 text-sm">
        <Stat label="Open CTR" value={(counts.find((c: any) => c.alertType === 'CTR' && c.status === 'OPEN') as any)?._count?._all ?? 0} />
        <Stat label="Open STR" value={(counts.find((c: any) => c.alertType === 'STR' && c.status === 'OPEN') as any)?._count?._all ?? 0} />
        <Stat label="Open sanctions" value={(counts.find((c: any) => c.alertType === 'SANCTIONS_HIT' && c.status === 'OPEN') as any)?._count?._all ?? 0} />
        <Stat label="Reported to FIC" value={(counts as any[]).filter((c: any) => c.status === 'REPORTED_TO_FIC').reduce((s: any, c: any) => s + (c._count?._all ?? 0), 0)} />
        <Stat label="Total ever" value={(counts as any[]).reduce((s: any, c: any) => s + (c._count?._all ?? 0), 0)} />
      </div>

      <form className="card p-4 flex flex-wrap items-end gap-3" method="get">
        <div>
          <label className="label">Status</label>
          <select className="input" name="status" defaultValue={status}>
            <option value="OPEN">Open</option>
            <option value="INVESTIGATING">Investigating</option>
            <option value="REPORTED_TO_FIC">Reported to FIC</option>
            <option value="DISMISSED">Dismissed</option>
            <option value="ESCALATED">Escalated</option>
          </select>
        </div>
        <div>
          <label className="label">Type</label>
          <select className="input" name="type" defaultValue={type ?? ''}>
            <option value="">All</option>
            <option value="CTR">CTR</option>
            <option value="STR">STR</option>
            <option value="SANCTIONS_HIT">Sanctions</option>
            <option value="KYC_RISK">KYC risk</option>
            <option value="UNUSUAL_PATTERN">Unusual pattern</option>
          </select>
        </div>
        <button className="btn btn-secondary">Apply</button>
      </form>

      <div className="card overflow-x-auto">
        <table className="table-base responsive-table">
          <thead>
            <tr>
              <th>Type</th>
              <th>Severity</th>
              <th>Description</th>
              <th>Borrower</th>
              <th>Amount</th>
              <th>Triggered</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {alerts.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-8 text-slate-500">No alerts match the filter.</td></tr>
            ) : alerts.map((a: any) => (
              <tr key={a.id}>
                <td>
                  <span className={`badge ${a.alertType === 'STR' ? 'badge-red' : a.alertType === 'CTR' ? 'badge-amber' : 'badge-blue'}`}>
                    {a.alertType}
                  </span>
                </td>
                <td>
                  <span className={`badge ${a.severity === 'CRITICAL' || a.severity === 'HIGH' ? 'badge-red' : a.severity === 'MEDIUM' ? 'badge-amber' : 'badge-gray'}`}>
                    {a.severity}
                  </span>
                </td>
                <td className="text-sm">{a.description}</td>
                <td>
                  {a.borrower ? (
                    <Link href={`/borrowers/${a.borrowerId}`} className="text-brand-700 hover:underline">
                      {a.borrower.firstName} {a.borrower.lastName}
                      <div className="text-xs text-slate-500 font-mono">{a.borrower.borrowerNo}</div>
                    </Link>
                  ) : '—'}
                </td>
                <td className="text-xs">—</td>
                <td className="text-xs">{formatDate(a.triggeredAt)}</td>
                <td>
                  <span className={`badge ${a.status === 'OPEN' ? 'badge-amber' : a.status === 'REPORTED_TO_FIC' ? 'badge-blue' : a.status === 'DISMISSED' ? 'badge-gray' : 'badge-red'}`}>
                    {a.status.replace(/_/g, ' ')}
                  </span>
                </td>
                <td>
                  <Link href={`/aml/${a.id}`} className="text-brand-700 hover:underline">Review →</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-xs text-slate-500 uppercase">{label}</div>
      <div className="text-2xl font-bold">{value}</div>
    </div>
  );
}
