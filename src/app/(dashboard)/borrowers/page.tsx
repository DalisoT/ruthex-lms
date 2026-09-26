import { sql, eq, desc, asc, and, or, inArray, ne, gte, lte, gt, lt, isNull, like, ilike } from 'drizzle-orm';
import { db } from '@/lib/db';
import { borrowers, loans, repayments, amlAlerts, auditLogs, users, branches, loanApplications, loanProducts, notifications } from '@/lib/db/schema';

import Link from 'next/link';
import { formatDate } from '@/lib/utils';

export const metadata = { title: 'Borrowers — RUTHEX' };

interface SearchParams { q?: string; status?: string; page?: string }

export default async function BorrowersListPage({ searchParams }: { searchParams: SearchParams }) {
  const q = (searchParams.q ?? '').trim();
  const status = searchParams.status;
  const page = Math.max(1, parseInt(searchParams.page ?? '1', 10) || 1);
  const PAGE_SIZE = 25;

  const where = {
    AND: [
      q ? {
        OR: [
          { firstName: { contains: q } },
          { lastName: { contains: q } },
          { borrowerNo: { contains: q } },
          { nrcNumber: { contains: q } },
          { phone: { contains: q } },
        ],
      } : {},
      status ? { status: status as any } : {},
    ],
  };

  const [total, borrowers] = await Promise.all([
    prisma.borrower.count({ where }),
    prisma.borrower.findMany({
      where,
      include: { _count: { select: { loans: true } } },
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
  ]);

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold">Borrowers</h1>
          <p className="text-sm text-slate-500">All individuals and entities on the RUTHEX book.</p>
        </div>
        <Link href="/borrowers/new" className="btn btn-primary">+ Onboard new borrower</Link>
      </div>

      <form className="card p-4 flex flex-wrap items-end gap-3" method="get">
        <div className="flex-1 min-w-[200px]">
          <label className="label">Search</label>
          <input className="input" name="q" defaultValue={q} placeholder="Name, borrower no., NRC, phone…" />
        </div>
        <div>
          <label className="label">Status</label>
          <select className="input" name="status" defaultValue={status ?? ''}>
            <option value="">All</option>
            <option value="ACTIVE">Active</option>
            <option value="BLACKLISTED">Blacklisted</option>
            <option value="DECEASED">Deceased</option>
            <option value="CLOSED">Closed</option>
          </select>
        </div>
        <button className="btn btn-secondary">Apply</button>
      </form>

      <div className="card overflow-x-auto">
        <table className="table-base responsive-table">
          <thead>
            <tr>
              <th>Borrower #</th>
              <th>Name</th>
              <th>NRC</th>
              <th>Phone</th>
              <th>KYC</th>
              <th>Loans</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {borrowers.length === 0 ? (
              <tr><td colSpan={8} className="text-center py-8 text-slate-500">No borrowers found.</td></tr>
            ) : borrowers.map((b) => (
              <tr key={b.id}>
                <td className="font-mono text-xs">{b.borrowerNo}</td>
                <td>{b.firstName} {b.lastName}</td>
                <td className="font-mono text-xs">{b.nrcNumber ?? '—'}</td>
                <td>{b.phone}</td>
                <td>
                  <span className={
                    b.kycStatus === 'APPROVED' ? 'badge-green'
                    : b.kycStatus === 'REJECTED' ? 'badge-red'
                    : b.kycStatus === 'IN_REVIEW' ? 'badge-amber'
                    : 'badge-gray'
                  }>{b.kycStatus}</span>
                </td>
                <td>{b._count.loans}</td>
                <td className="text-xs">{formatDate(b.createdAt)}</td>
                <td><Link href={`/borrowers/${b.id}`} className="text-brand-700 hover:underline">Open →</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <div className="text-slate-500">{total} borrower{total === 1 ? '' : 's'} · page {page} of {totalPages}</div>
          <div className="space-x-2">
            {page > 1 && <Link href={`?${new URLSearchParams({ ...searchParams, page: String(page - 1) })}`} className="btn btn-secondary">← Prev</Link>}
            {page < totalPages && <Link href={`?${new URLSearchParams({ ...searchParams, page: String(page + 1) })}`} className="btn btn-secondary">Next →</Link>}
          </div>
        </div>
      )}
    </div>
  );
}
