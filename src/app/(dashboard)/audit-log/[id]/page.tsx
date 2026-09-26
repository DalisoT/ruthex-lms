import { sql, eq, desc, asc, and, or, inArray, ne, gte, lte, gt, lt, isNull, like, ilike } from 'drizzle-orm';
import { db, prisma } from '@/lib/db';
import { borrowers, loans, repayments, amlAlerts, auditLogs, users, branches, loanApplications, loanProducts, notifications } from '@/lib/db/schema';

import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/rbac';
import Link from 'next/link';
import { formatDateTime } from '@/lib/utils';

export const metadata = { title: 'Audit entry — RUTHEX' };

export default async function AuditDetailPage({ params }: { params: { id: string } }) {
  await requireRole('compliance');
  const entry = await prisma.auditLog.findUnique({
    where: { id: params.id },
    include: { user: { select: { fullName: true, email: true } } },
  });
  if (!entry) notFound();

  return (
    <div className="space-y-4">
      <div>
        <Link href="/audit-log" className="text-sm text-brand-700 hover:underline">← Audit log</Link>
        <h1 className="text-2xl font-bold mt-1">{entry.action}</h1>
        <p className="text-sm text-slate-500">{formatDateTime(entry.occurredAt)}</p>
      </div>

      <div className="card-padded space-y-2">
        <Row k="Entity" v={`${entry.entity}${entry.entityId ? ` (${entry.entityId})` : ''}`} />
        <Row k="User" v={entry.user ? `${entry.user.fullName} <${entry.user.email}>` : 'System'} />
        <Row k="IP" v={entry.ipAddress ?? '—'} />
        <Row k="User agent" v={entry.userAgent ?? '—'} />
        <Row k="Hash" v={entry.hash ?? '—'} mono />
        <Row k="Previous hash" v={entry.prevHash ?? '—'} mono />
      </div>

      {entry.meta && (
        <div className="card-padded">
          <h2 className="font-bold mb-2">Payload</h2>
          <pre className="bg-slate-50 border border-slate-200 rounded p-3 text-xs overflow-x-auto">{JSON.stringify(JSON.parse(entry.meta), null, 2)}</pre>
        </div>
      )}
    </div>
  );
}

function Row({ k, v, mono }: { k: string; v: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3 border-b border-slate-100 pb-1">
      <dt className="text-slate-500">{k}</dt>
      <dd className={`text-right break-all ${mono ? 'font-mono text-xs' : 'font-medium'}`}>{v}</dd>
    </div>
  );
}
