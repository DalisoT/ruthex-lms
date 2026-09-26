import { sql, eq, desc, asc, and, or, inArray, ne, gte, lte, gt, lt, isNull, like, ilike } from 'drizzle-orm';
import { db } from '@/lib/db';
import { borrowers, loans, repayments, amlAlerts, auditLogs, users, branches, loanApplications, loanProducts, notifications } from '@/lib/db/schema';

import Link from 'next/link';
import { formatZMW, formatDate } from '@/lib/utils';

export const metadata = { title: 'Loans — RUTHEX' };

interface SearchParams { q?: string; status?: string; page?: string }

export default async function LoansListPage({ searchParams }: { searchParams: SearchParams }) {
  const q = (searchParams.q ?? '').trim();
  const status = searchParams.status;
  const page = Math.max(1, parseInt(searchParams.page ?? '1', 10) || 1);
  const PAGE_SIZE = 25;

  const where = {
    AND: [
      q ? {
        OR: [
          { loanNo: { contains: q } },
          { borrower: { firstName: { contains: q } } },
          { borrower: { lastName: { contains: q } } },
          { borrower: { borrowerNo: { contains: q } } },
        ],
      } : {},
      status ? { status: status as any } : {},
    ],
  };

  const [total, loans] = await Promise.all([
    prisma.loan.count({ where }),
    prisma.loan.findMany({
      where,
      include: { borrower: { select: { borrowerNo: true, firstName: true, lastName: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);
  const totals = await prisma.loan.aggregate({
    _sum: { principalOutstandingZMW: true, totalOutstandingZMW: true },
    where: { status: { in: ['ACTIVE', 'IN_ARREARS', 'RESTRUCTURED'] } },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold">Loans</h1>
          <p className="text-sm text-slate-500">
            Principal on book {formatZMW(totals._sum.principalOutstandingZMW)} · Total outstanding {formatZMW(totals._sum.totalOutstandingZMW)}
          </p>
        </div>
        <Link href="/loans/new" className="btn btn-primary">+ New loan application</Link>
      </div>

      <form className="card p-4 flex flex-wrap items-end gap-3" method="get">
        <div className="flex-1 min-w-[200px]">
          <label className="label">Search</label>
          <input className="input" name="q" defaultValue={q} placeholder="Loan #, borrower…" />
        </div>
        <div>
          <label className="label">Status</label>
          <select className="input" name="status" defaultValue={status ?? ''}>
            <option value="">All</option>
            <option value="PENDING_DISBURSEMENT">Pending disbursement</option>
            <option value="ACTIVE">Active</option>
            <option value="IN_ARREARS">In arrears</option>
            <option value="RESTRUCTURED">Restructured</option>
            <option value="DEFAULTED">Defaulted</option>
            <option value="WRITTEN_OFF">Written off</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>
        <button className="btn btn-secondary">Apply</button>
      </form>

      <div className="card overflow-x-auto">
        <table className="table-base responsive-table">
          <thead>
            <tr>
              <th>Loan #</th>
              <th>Borrower</th>
              <th>Status</th>
              <th>Principal</th>
              <th>Outstanding</th>
              <th>Days in arrears</th>
              <th>Disbursed</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {loans.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-8 text-slate-500">No loans match the filter.</td></tr>
            ) : loans.map((l) => (
              <tr key={l.id}>
                <td className="font-mono text-xs">{l.loanNo}</td>
                <td>
                  <Link href={`/borrowers/${l.borrowerId}`} className="text-brand-700 hover:underline">
                    {l.borrower.firstName} {l.borrower.lastName}
                  </Link>
                  <div className="text-xs text-slate-500 font-mono">{l.borrower.borrowerNo}</div>
                </td>
                <td><StatusBadge status={l.status} /></td>
                <td>{formatZMW(l.principalZMW)}</td>
                <td>{formatZMW(l.totalOutstandingZMW)}</td>
                <td className={l.daysInArrears > 0 ? 'text-red-700 font-semibold' : ''}>{l.daysInArrears}d</td>
                <td className="text-xs">{l.disbursedAt ? formatDate(l.disbursedAt) : '—'}</td>
                <td><Link href={`/loans/${l.id}`} className="text-brand-700 hover:underline">Open →</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <div className="text-slate-500">{total} loan{total === 1 ? '' : 's'} · page {page} of {totalPages}</div>
          <div className="space-x-2">
            {page > 1 && <Link href={`?${new URLSearchParams({ ...searchParams, page: String(page - 1) })}`} className="btn btn-secondary">← Prev</Link>}
            {page < totalPages && <Link href={`?${new URLSearchParams({ ...searchParams, page: String(page + 1) })}`} className="btn btn-secondary">Next →</Link>}
          </div>
        </div>
      )}
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    ACTIVE: 'badge-green',
    IN_ARREARS: 'badge-amber',
    RESTRUCTURED: 'badge-amber',
    DEFAULTED: 'badge-red',
    WRITTEN_OFF: 'badge-red',
    CLOSED: 'badge-gray',
    PENDING_DISBURSEMENT: 'badge-blue',
  };
  return <span className={`badge ${map[status] ?? 'badge-gray'}`}>{status.replace(/_/g, ' ')}</span>;
}
