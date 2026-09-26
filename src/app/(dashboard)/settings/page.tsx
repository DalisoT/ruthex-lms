import { sql, eq, desc, asc, and, or, inArray, ne, gte, lte, gt, lt, isNull, like, ilike } from 'drizzle-orm';
import { db } from '@/lib/db';
import { borrowers, loans, repayments, amlAlerts, auditLogs, users, branches, loanApplications, loanProducts, notifications } from '@/lib/db/schema';

import { getCurrentSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { formatZMW, formatDate } from '@/lib/utils';
import { verifyAuditChain } from '@/lib/audit';

export const metadata = { title: 'Settings — RUTHEX' };

export default async function SettingsPage() {
  const session = await getCurrentSession();
  if (!session) redirect('/login');

  const [userCount, branchCount, borrowerCount, loanProductCount, auditResult] = await Promise.all([
    prisma.user.count(),
    prisma.branch.count(),
    prisma.borrower.count(),
    prisma.loanProduct.count(),
    verifyAuditChain(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Settings</h1>
        <p className="text-sm text-slate-500">Administration, environment, and audit log integrity.</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Users" value={userCount.toString()} />
        <Stat label="Branches" value={branchCount.toString()} />
        <Stat label="Borrowers" value={borrowerCount.toString()} />
        <Stat label="Loan products" value={loanProductCount.toString()} />
      </div>

      <div className="card-padded">
        <h2 className="font-bold mb-3">Environment</h2>
        <dl className="text-sm space-y-1">
          <Row label="App name" value={process.env.NEXT_PUBLIC_APP_NAME ?? 'RUTHEX Lending Institution'} />
          <Row label="Mobile money provider" value={process.env.MOBILE_MONEY_PROVIDER ?? 'mock'} />
          <Row label="CTR threshold (USD)" value={process.env.CTR_THRESHOLD_USD ?? '10000'} />
          <Row label="NDT MFI minimum capital (ZMW)" value="100,000" />
          <Row label="MFI CAR floor" value="15.00%" />
          <Row label="Session TTL (hours)" value={process.env.SESSION_TTL_HOURS ?? '8'} />
        </dl>
      </div>

      <div className="card-padded">
        <h2 className="font-bold mb-3">Audit log integrity</h2>
        {auditResult.ok ? (
          <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-3 py-2">
            Audit chain hash is intact. Every recorded action is linked by SHA-256 to its predecessor.
          </div>
        ) : (
          <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">
            Audit chain broken at entry {auditResult.brokenAt}. Investigate immediately and reseal the log.
          </div>
        )}
        <p className="text-xs text-slate-500 mt-3">
          RUTHEX persists every privileged action with a hash chain. Tampering with any historical row breaks the chain.
        </p>
      </div>

      <div className="card-padded">
        <h2 className="font-bold mb-3">User</h2>
        <dl className="text-sm space-y-1">
          <Row label="Email" value={session.email} />
          <Row label="Role" value={session.role} />
          <Row label="Branch ID" value={session.branchId ?? '—'} />
        </dl>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card-padded">
      <div className="text-xs text-slate-500 uppercase">{label}</div>
      <div className="text-2xl font-bold mt-1">{value}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3 border-b border-slate-100 pb-1">
      <dt className="text-slate-500">{label}</dt>
      <dd className="font-medium text-right">{value}</dd>
    </div>
  );
}
