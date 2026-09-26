import { sql, eq, desc, asc, and, or, inArray, ne, gte, lte, gt, lt, isNull, like, ilike } from 'drizzle-orm';
import { db, prisma } from '@/lib/db';
import { borrowers, loans, repayments, amlAlerts, auditLogs, users, branches, loanApplications, loanProducts, notifications } from '@/lib/db/schema';

import { getCurrentSession } from '@/lib/auth';
import Link from 'next/link';
import { formatDateTime } from '@/lib/utils';

export const metadata = { title: 'Notifications — RUTHEX' };

export default async function NotificationsInbox() {
  const session = await getCurrentSession();
  if (!session) return null;
  const [items, unread] = await Promise.all([
    prisma.notification.findMany({
      where: { OR: [{ userId: session.userId }, { borrowerId: null }] },
      orderBy: { createdAt: 'desc' },
      take: 100,
    }),
    prisma.notification.count({
      where: { OR: [{ userId: session.userId }, { borrowerId: null }], status: { in: ['PENDING', 'SENT'] } },
    }),
  ]);
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Notifications</h1>
          <p className="text-sm text-slate-500">Inbox of recent system events, AML triggers, and outbound messages.</p>
        </div>
        <div className="text-sm text-slate-500">{unread} active</div>
      </div>
      <div className="card divide-y divide-slate-100">
        {items.length === 0 ? (
          <div className="px-6 py-8 text-center text-slate-500">No notifications yet.</div>
        ) : items.map((n: any) => (
          <div key={n.id} className="px-6 py-4 flex items-start gap-4">
            <ChannelBadge channel={n.channel} />
            <div className="flex-1">
              <div className="flex items-center justify-between gap-2">
                <div className="text-sm font-semibold">{n.subject ?? n.body.slice(0, 80)}</div>
                <span className="text-xs text-slate-500 whitespace-nowrap">{formatDateTime(n.createdAt)}</span>
              </div>
              <p className="text-sm text-slate-700 mt-1">{n.body}</p>
              <div className="text-xs text-slate-500 mt-1">
                {n.recipient && <>to <span className="font-mono">{n.recipient}</span> · </>}
                {n.relatedEntity && <>{n.relatedEntity}{n.relatedEntityId && <span className="font-mono"> {n.relatedEntityId.slice(0, 10)}</span>}</>}
              </div>
            </div>
            <span className={`badge ${n.status === 'PENDING' ? 'badge-amber' : n.status === 'SENT' ? 'badge-blue' : n.status === 'FAILED' ? 'badge-red' : 'badge-gray'}`}>{n.status}</span>
          </div>
        ))}
      </div>
      <p className="text-xs text-slate-500">Tip: link outbound notifications to borrower/loan entities by populating <code>relatedEntity</code> + <code>relatedEntityId</code> at the call site (see <Link href="/aml" className="text-brand-700 hover:underline">AML</Link> page for the alerts that drive most outbound traffic).</p>
    </div>
  );
}

function ChannelBadge({ channel }: { channel: string }) {
  const map: Record<string, string> = {
    SMS: 'badge-blue',
    EMAIL: 'badge-blue',
    WHATSAPP: 'badge-green',
    IN_APP: 'badge-gray',
    USSD: 'badge-amber',
  };
  return <span className={`badge ${map[channel] ?? 'badge-gray'} shrink-0`}>{channel}</span>;
}
