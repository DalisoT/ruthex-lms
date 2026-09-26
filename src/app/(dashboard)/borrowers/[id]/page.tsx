import { sql, eq, desc, asc, and, or, inArray, ne, gte, lte, gt, lt, isNull, like, ilike } from 'drizzle-orm';
import { db, prisma } from '@/lib/db';
import { borrowers, loans, repayments, amlAlerts, auditLogs, users, branches, loanApplications, loanProducts, notifications } from '@/lib/db/schema';

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { formatZMW, formatDate } from '@/lib/utils';
import KycActions from './KycActions';

export const metadata = { title: 'Borrower — RUTHEX' };

export default async function BorrowerDetailPage({ params }: { params: { id: string } }) {
  const borrower = await prisma.borrower.findUnique({
    where: { id: params.id },
    include: {
      documents: { orderBy: { createdAt: 'desc' } },
      addresses: true,
      nextOfKin: true,
      loans: { orderBy: { createdAt: 'desc' }, include: { repayments: true } },
      applications: { orderBy: { createdAt: 'desc' }, take: 5 },
      riskAssessments: { orderBy: { assessedAt: 'desc' }, take: 5 },
    },
  });
  if (!borrower) notFound();

  const totalOutstanding = borrower.loans.reduce((s: any, l: any) => s + l.totalOutstandingZMW, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/borrowers" className="text-sm text-brand-700 hover:underline">← Borrowers</Link>
          <h1 className="text-2xl font-bold mt-1">{borrower.firstName} {borrower.lastName}</h1>
          <p className="text-sm text-slate-500 font-mono">{borrower.borrowerNo} · NRC {borrower.nrcNumber ?? '—'} · {borrower.phone}</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className={
            borrower.kycStatus === 'APPROVED' ? 'badge-green'
            : borrower.kycStatus === 'REJECTED' ? 'badge-red'
            : borrower.kycStatus === 'IN_REVIEW' ? 'badge-amber'
            : 'badge-gray'
          }>KYC: {borrower.kycStatus}</span>
          <span className={`badge ${borrower.kycRiskRating === 'HIGH' ? 'badge-red' : borrower.kycRiskRating === 'LOW' ? 'badge-green' : 'badge-amber'}`}>
            Risk: {borrower.kycRiskRating}
          </span>
          {borrower.pepFlag && <span className="badge-red">PEP</span>}
          <Link href={`/loans/new?borrowerId=${borrower.id}`} className="btn btn-primary">+ New loan application</Link>
          <Link href={`/borrowers/${borrower.id}/statement`} className="btn btn-secondary">Statement / Print PDF</Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="card-padded">
          <div className="text-xs text-slate-500 uppercase">Total outstanding</div>
          <div className="text-2xl font-bold mt-1">{formatZMW(totalOutstanding)}</div>
          <div className="text-xs text-slate-500 mt-1">{borrower.loans.length} loan(s) on book</div>
        </div>
        <div className="card-padded">
          <div className="text-xs text-slate-500 uppercase">Monthly income (declared)</div>
          <div className="text-2xl font-bold mt-1">{formatZMW(borrower.monthlyIncomeZMW)}</div>
          <div className="text-xs text-slate-500 mt-1">{borrower.employmentStatus ?? '—'} · {borrower.occupation ?? '—'}</div>
        </div>
        <div className="card-padded">
          <div className="text-xs text-slate-500 uppercase">Address</div>
          <div className="text-sm mt-1">
            {borrower.addressLine1 ?? '—'}<br />
            {[borrower.city, borrower.province, borrower.district].filter(Boolean).join(' / ')}
          </div>
        </div>
      </div>

      <KycActions borrowerId={borrower.id} status={borrower.kycStatus} />

      <div className="card overflow-x-auto">
        <div className="px-6 py-4 border-b">
          <h2 className="font-bold">Loans</h2>
        </div>
        {borrower.loans.length === 0 ? (
          <div className="px-6 py-6 text-sm text-slate-500">No loans yet for this borrower.</div>
        ) : (
          <table className="table-base responsive-table">
            <thead>
              <tr>
                <th>Loan #</th>
                <th>Status</th>
                <th>Principal</th>
                <th>Outstanding</th>
                <th>Days in arrears</th>
                <th>Disbursed</th>
              </tr>
            </thead>
            <tbody>
              {borrower.loans.map((l: any) => (
                <tr key={l.id}>
                  <td className="font-mono text-xs"><Link href={`/loans/${l.id}`} className="text-brand-700 hover:underline">{l.loanNo}</Link></td>
                  <td><StatusBadge status={l.status} /></td>
                  <td>{formatZMW(l.principalZMW)}</td>
                  <td>{formatZMW(l.totalOutstandingZMW)}</td>
                  <td className={l.daysInArrears > 0 ? 'text-red-700 font-semibold' : ''}>{l.daysInArrears}d</td>
                  <td className="text-xs">{l.disbursedAt ? formatDate(l.disbursedAt) : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <div className="card overflow-x-auto">
        <div className="px-6 py-4 border-b">
          <h2 className="font-bold">KYC documents</h2>
        </div>
        {borrower.documents.length === 0 ? (
          <div className="px-6 py-6 text-sm text-slate-500">No documents uploaded. (Document upload UI is in scope of a follow-up release.)</div>
        ) : (
          <table className="table-base responsive-table">
            <thead>
              <tr>
                <th>Type</th>
                <th>File</th>
                <th>Verified</th>
                <th>Uploaded</th>
              </tr>
            </thead>
            <tbody>
              {borrower.documents.map((d: any) => (
                <tr key={d.id}>
                  <td className="font-medium">{d.type}</td>
                  <td className="text-xs font-mono">{d.fileName}</td>
                  <td>{d.verified ? <span className="badge-green">Verified</span> : <span className="badge-gray">Pending</span>}</td>
                  <td className="text-xs">{formatDate(d.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
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
