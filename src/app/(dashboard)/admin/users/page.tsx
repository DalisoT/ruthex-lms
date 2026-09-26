import { sql, eq, desc, asc, and, or, inArray, ne, gte, lte, gt, lt, isNull, like, ilike } from 'drizzle-orm';
import { db, prisma } from '@/lib/db';
import { borrowers, loans, repayments, amlAlerts, auditLogs, users, branches, loanApplications, loanProducts, notifications } from '@/lib/db/schema';

import Link from 'next/link';
import { requireRole, roleLabel } from '@/lib/rbac';
import { formatDate } from '@/lib/utils';

export const metadata = { title: 'Users — Admin — RUTHEX' };

export default async function AdminUsersPage() {
  await requireRole('admin');
  const [users, branches] = await Promise.all([
    prisma.user.findMany({ orderBy: { createdAt: 'asc' }, include: { branch: { select: { name: true, code: true } } } }),
    prisma.branch.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
  ]);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Users</h1>
          <p className="text-sm text-slate-500">RUTHEX operators. Only administrators can create or change roles here.</p>
        </div>
        <Link href="/admin/users/new" className="btn btn-primary">+ Add user</Link>
      </div>

      <div className="card overflow-x-auto">
        <table className="table-base responsive-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Role</th>
              <th>Branch</th>
              <th>Fit &amp; proper</th>
              <th>Last login</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {users.map((u: any) => (
              <tr key={u.id}>
                <td className="font-medium">{u.fullName}</td>
                <td className="font-mono text-xs">{u.email}</td>
                <td><span className="badge-blue">{roleLabel(u.role as any)}</span></td>
                <td className="text-xs">{u.branch ? `${u.branch.code} — ${u.branch.name}` : '—'}</td>
                <td>
                  {u.fitProperStatus ? (
                    <span className={`badge ${u.fitProperStatus === 'PASSED' ? 'badge-green' : u.fitProperStatus === 'PENDING' ? 'badge-amber' : 'badge-red'}`}>
                      {u.fitProperStatus}
                    </span>
                  ) : <span className="text-slate-400 text-xs">—</span>}
                </td>
                <td className="text-xs">{u.lastLoginAt ? formatDate(u.lastLoginAt) : 'Never'}</td>
                <td>
                  {u.active ? <span className="badge-green">Active</span> : <span className="badge-gray">Disabled</span>}
                  {u.failedLoginCount > 0 && <span className="badge-amber ml-1">{u.failedLoginCount} fail</span>}
                </td>
                <td>
                  <Link href={`/admin/users/${u.id}`} className="text-brand-700 hover:underline">Edit →</Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
