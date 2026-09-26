import { sql, eq, desc, asc, and, or, inArray, ne, gte, lte, gt, lt, isNull, like, ilike } from 'drizzle-orm';
import { db, prisma } from '@/lib/db';
import { borrowers, loans, repayments, amlAlerts, auditLogs, users, branches, loanApplications, loanProducts, notifications } from '@/lib/db/schema';

import Link from 'next/link';
import { requireRole } from '@/lib/rbac';
import { formatDate } from '@/lib/utils';

export const metadata = { title: 'Branches — Admin — RUTHEX' };

export default async function BranchesPage() {
  await requireRole('admin');
  const branches = await prisma.branch.findMany({
    orderBy: { code: 'asc' },
    include: { _count: { select: { users: true, borrowers: true, loans: true } } },
  });
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Branches</h1>
          <p className="text-sm text-slate-500">RUTHEX locations. Each branch scopes its own users, borrowers, and loans.</p>
        </div>
        <Link href="/admin/branches/new" className="btn btn-primary">+ Add branch</Link>
      </div>
      <div className="card overflow-x-auto">
        <table className="table-base responsive-table">
          <thead>
            <tr>
              <th>Code</th>
              <th>Name</th>
              <th>Location</th>
              <th>Phone</th>
              <th>Users</th>
              <th>Borrowers</th>
              <th>Loans</th>
              <th>Status</th>
              <th>Created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {branches.length === 0 ? (
              <tr><td colSpan={10} className="text-center py-8 text-slate-500">No branches yet.</td></tr>
            ) : branches.map((b: any) => (
              <tr key={b.id}>
                <td className="font-mono text-xs">{b.code}</td>
                <td className="font-medium">{b.name}</td>
                <td className="text-xs">{[b.city, b.province].filter(Boolean).join(', ') || '—'}</td>
                <td className="text-xs">{b.phone ?? '—'}</td>
                <td>{b._count.users}</td>
                <td>{b._count.borrowers}</td>
                <td>{b._count.loans}</td>
                <td>{b.active ? <span className="badge-green">Active</span> : <span className="badge-gray">Off</span>}</td>
                <td className="text-xs">{formatDate(b.createdAt)}</td>
                <td><Link href={`/admin/branches/${b.id}`} className="text-brand-700 hover:underline">Edit →</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
