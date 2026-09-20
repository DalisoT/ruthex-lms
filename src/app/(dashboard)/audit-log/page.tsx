import { prisma } from '@/lib/db';
import { verifyAuditChain } from '@/lib/audit';
import { requireRole } from '@/lib/rbac';
import { formatDateTime } from '@/lib/utils';
import Link from 'next/link';

export const metadata = { title: 'Audit log — RUTHEX' };

interface SearchParams { q?: string; entity?: string; userId?: string; page?: string; broken?: string }

export default async function AuditLogPage({ searchParams }: { searchParams: SearchParams }) {
  await requireRole('compliance');
  const q = (searchParams.q ?? '').trim();
  const entity = searchParams.entity;
  const userId = searchParams.userId;
  const page = Math.max(1, parseInt(searchParams.page ?? '1', 10) || 1);
  const PAGE_SIZE = 50;

  const where = {
    AND: [
      q ? {
        OR: [
          { action: { contains: q } },
          { entity: { contains: q } },
          { entityId: { contains: q } },
          { meta: { contains: q } },
        ],
      } : {},
      entity ? { entity } : {},
      userId ? { userId } : {},
    ],
  };

  const [total, rows, integrity, users] = await Promise.all([
    prisma.auditLog.count({ where }),
    prisma.auditLog.findMany({
      where,
      include: { user: { select: { fullName: true, email: true } } },
      orderBy: { occurredAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    verifyAuditChain(),
    prisma.user.findMany({ orderBy: { fullName: 'asc' }, select: { id: true, fullName: true, email: true } }),
  ]);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Audit log</h1>
          <p className="text-sm text-slate-500">Every privileged action is sealed with a SHA-256 hash chain. Click an entry to view its payload.</p>
        </div>
        <div>
          {integrity.ok ? (
            <span className="badge-green">Chain intact</span>
          ) : (
            <span className="badge-red">Chain broken at {integrity.brokenAt}</span>
          )}
        </div>
      </div>

      <form className="card p-4 flex flex-wrap items-end gap-3" method="get">
        <div className="flex-1 min-w-[200px]">
          <label className="label">Search</label>
          <input className="input" name="q" defaultValue={q} placeholder="Action, entity, meta…" />
        </div>
        <div>
          <label className="label">Entity</label>
          <select className="input" name="entity" defaultValue={entity ?? ''}>
            <option value="">All</option>
            <option value="USER">User</option>
            <option value="BORROWER">Borrower</option>
            <option value="LOAN">Loan</option>
            <option value="LOAN_APPLICATION">Loan application</option>
            <option value="LOAN_PRODUCT">Loan product</option>
            <option value="REPAYMENT">Repayment</option>
            <option value="AML_ALERT">AML alert</option>
            <option value="BRANCH">Branch</option>
            <option value="BOZ_REPORT">BOZ report</option>
            <option value="USSD">USSD</option>
            <option value="MOBILE_MONEY_TRANSACTION">Mobile money</option>
            <option value="SYSTEM">System</option>
          </select>
        </div>
        <div>
          <label className="label">User</label>
          <select className="input" name="userId" defaultValue={userId ?? ''}>
            <option value="">Anyone</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>{u.fullName} ({u.email})</option>
            ))}
          </select>
        </div>
        <button className="btn btn-secondary">Apply</button>
      </form>

      <div className="card overflow-x-auto">
        <table className="table-base responsive-table">
          <thead>
            <tr>
              <th>When</th>
              <th>User</th>
              <th>Action</th>
              <th>Entity</th>
              <th>Entity ID</th>
              <th>Hash (prefix)</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8 text-slate-500">No audit entries match the filter.</td></tr>
            ) : rows.map((r) => (
              <tr key={r.id}>
                <td className="text-xs whitespace-nowrap">{formatDateTime(r.occurredAt)}</td>
                <td className="text-xs">{r.user ? `${r.user.fullName}` : <span className="text-slate-400">—</span>}</td>
                <td><span className="badge-blue text-xs">{r.action}</span></td>
                <td className="text-xs">{r.entity}</td>
                <td className="text-xs font-mono">{r.entityId?.slice(0, 12) ?? '—'}</td>
                <td className="text-xs font-mono text-slate-500">{r.hash?.slice(0, 10) ?? '—'}…</td>
                <td>
                  {r.entityId ? (
                    <Link href={`/audit-log/${r.id}`} className="text-brand-700 hover:underline">Details</Link>
                  ) : '—'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <div className="text-slate-500">{total} entries · page {page} of {totalPages}</div>
          <div className="space-x-2">
            {page > 1 && <Link href={`?${new URLSearchParams({ ...searchParams, page: String(page - 1) })}`} className="btn btn-secondary">← Prev</Link>}
            {page < totalPages && <Link href={`?${new URLSearchParams({ ...searchParams, page: String(page + 1) })}`} className="btn btn-secondary">Next →</Link>}
          </div>
        </div>
      )}
    </div>
  );
}
