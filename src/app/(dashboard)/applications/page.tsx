import { sql, eq, desc, asc, and, or, inArray, ne, gte, lte, gt, lt, isNull, like, ilike } from 'drizzle-orm';
import { db, prisma } from '@/lib/db';
import { borrowers, loans, repayments, amlAlerts, auditLogs, users, branches, loanApplications, loanProducts, notifications } from '@/lib/db/schema';

import Link from 'next/link';
import { formatZMW, formatDate } from '@/lib/utils';

export const metadata = { title: 'Loan applications — RUTHEX' };

interface SearchParams { q?: string; status?: string; page?: string }

export default async function ApplicationsPage({ searchParams }: { searchParams: SearchParams }) {
  const q = (searchParams.q ?? '').trim();
  const status = searchParams.status;
  const page = Math.max(1, parseInt(searchParams.page ?? '1', 10) || 1);
  const PAGE_SIZE = 25;

  const where = {
    AND: [
      q ? {
        OR: [
          { applicationNo: { contains: q } },
          { borrower: { firstName: { contains: q } } },
          { borrower: { lastName: { contains: q } } },
          { borrower: { borrowerNo: { contains: q } } },
        ],
      } : {},
      status ? { status: status as any } : {},
    ],
  };

  const [total, applications] = await Promise.all([
    prisma.loanApplication.count({ where }),
    prisma.loanApplication.findMany({
      where,
      include: {
        borrower: { select: { firstName: true, lastName: true, borrowerNo: true, kycStatus: true } },
        product: { select: { name: true, interestRateAnnualPct: true } },
        assignedOfficer: { select: { fullName: true } },
        approvals: { orderBy: { decidedAt: 'asc' } },
      },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  // Pipeline counts
  const counts = await prisma.loanApplication.groupBy({
    by: ['status'],
    _count: { _all: true },
  });

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Loan applications</h1>
        <p className="text-sm text-slate-500">Pipeline visibility for new applications. Active loans live in the Loans tab.</p>
      </div>

      <div className="card p-4 grid grid-cols-2 md:grid-cols-7 gap-3 text-sm">
        {['DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED', 'WITHDRAWN', 'DISBURSED'].map((s: any) => (
          <div key={s}>
            <div className="text-xs text-slate-500">{s.replace(/_/g, ' ')}</div>
            <div className="text-xl font-bold">{counts.find((c: any) => c.status === s)?._count._all ?? 0}</div>
          </div>
        ))}
      </div>

      <form className="card p-4 flex flex-wrap items-end gap-3" method="get">
        <div className="flex-1 min-w-[200px]">
          <label className="label">Search</label>
          <input className="input" name="q" defaultValue={q} placeholder="App #, borrower…" />
        </div>
        <div>
          <label className="label">Status</label>
          <select className="input" name="status" defaultValue={status ?? ''}>
            <option value="">All</option>
            <option value="DRAFT">Draft</option>
            <option value="SUBMITTED">Submitted</option>
            <option value="UNDER_REVIEW">Under review</option>
            <option value="APPROVED">Approved</option>
            <option value="REJECTED">Rejected</option>
            <option value="WITHDRAWN">Withdrawn</option>
            <option value="DISBURSED">Disbursed</option>
          </select>
        </div>
        <button className="btn btn-secondary">Apply</button>
      </form>

      <div className="card overflow-x-auto">
        <table className="table-base responsive-table">
          <thead>
            <tr>
              <th>App #</th>
              <th>Borrower</th>
              <th>Product</th>
              <th>Amount</th>
              <th>Term</th>
              <th>Score</th>
              <th>Status</th>
              <th>Approvals</th>
              <th>Submitted</th>
            </tr>
          </thead>
          <tbody>
            {applications.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-8 text-slate-500">No applications match the filter.</td></tr>
            ) : applications.map((a: any) => (
              <tr key={a.id}>
                <td className="font-mono text-xs">{a.applicationNo}</td>
                <td>
                  <Link href={`/borrowers/${a.borrowerId}`} className="text-brand-700 hover:underline">
                    {a.borrower.firstName} {a.borrower.lastName}
                  </Link>
                  <div className="text-xs text-slate-500 font-mono">{a.borrower.borrowerNo}</div>
                </td>
                <td className="text-xs">{a.product.name}</td>
                <td>{formatZMW(a.requestedAmountZMW)}</td>
                <td className="text-xs">{a.requestedTermMonths}m</td>
                <td className="text-xs">
                  {a.creditScore != null ? (
                    <span className={`font-medium ${a.creditScore >= 650 ? 'text-emerald-700' : a.creditScore >= 550 ? 'text-amber-700' : 'text-red-700'}`}>
                      {a.creditScore} ({a.creditGrade})
                    </span>
                  ) : '—'}
                </td>
                <td>
                  <span className={
                    a.status === 'APPROVED' || a.status === 'DISBURSED' ? 'badge-green'
                    : a.status === 'REJECTED' ? 'badge-red'
                    : a.status === 'UNDER_REVIEW' ? 'badge-amber'
                    : 'badge-blue'
                  }>{a.status.replace(/_/g, ' ')}</span>
                </td>
                <td className="text-xs">
                  {a.approvals.length === 0 ? <span className="text-slate-400">—</span> : (
                    <span>{a.approvals.length} step{a.approvals.length === 1 ? '' : 's'}</span>
                  )}
                </td>
                <td className="text-xs">{a.submittedAt ? formatDate(a.submittedAt) : '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <div className="text-slate-500">{total} application{total === 1 ? '' : 's'} · page {page} of {totalPages}</div>
          <div className="space-x-2">
            {page > 1 && <Link href={`?${new URLSearchParams({ ...searchParams, page: String(page - 1) })}`} className="btn btn-secondary">← Prev</Link>}
            {page < totalPages && <Link href={`?${new URLSearchParams({ ...searchParams, page: String(page + 1) })}`} className="btn btn-secondary">Next →</Link>}
          </div>
        </div>
      )}
    </div>
  );
}
