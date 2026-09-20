import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { requireRole } from '@/lib/rbac';
import { getCurrentSession } from '@/lib/auth';
import { formatZMW, formatDate, formatDateTime } from '@/lib/utils';
import ApprovalActions from '../../loans/[id]/ApprovalActions';

export const metadata = { title: 'Application — RUTHEX' };

export default async function ApplicationDetailPage({ params }: { params: { id: string } }) {
  await requireRole('lending');
  const [application, session] = await Promise.all([
    prisma.loanApplication.findUnique({
      where: { id: params.id },
      include: {
        borrower: true,
        product: true,
        assignedOfficer: { select: { fullName: true, email: true } },
        approvals: { include: { approver: { select: { fullName: true, email: true } } }, orderBy: { decidedAt: 'asc' } },
        loan: { select: { id: true, loanNo: true, status: true } },
      },
    }),
    getCurrentSession(),
  ]);
  if (!application) notFound();
  const factors = application.creditFactors ? JSON.parse(application.creditFactors) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/applications" className="text-sm text-brand-700 hover:underline">← Applications</Link>
          <h1 className="text-2xl font-bold mt-1">{application.applicationNo}</h1>
          <p className="text-sm text-slate-500">
            <Link href={`/borrowers/${application.borrowerId}`} className="text-brand-700 hover:underline">
              {application.borrower.firstName} {application.borrower.lastName}
            </Link>
            {' '}· {application.borrower.borrowerNo}
          </p>
        </div>
        <div>
          <span className={
            application.status === 'APPROVED' || application.status === 'DISBURSED' ? 'badge-green'
            : application.status === 'REJECTED' ? 'badge-red'
            : application.status === 'UNDER_REVIEW' ? 'badge-amber'
            : 'badge-blue'
          }>{application.status.replace(/_/g, ' ')}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Requested amount" value={formatZMW(application.requestedAmountZMW)} />
        <Stat label="Requested term" value={`${application.requestedTermMonths} months`} />
        <Stat label="Product" value={application.product.name} />
        <Stat label="Product rate" value={`${application.product.interestRateAnnualPct}% (${application.product.interestMethod.replace(/_/g, '-').toLowerCase()})`} />
        <Stat label="Purpose" value={`${application.purpose}${application.purposeDetail ? ` — ${application.purposeDetail}` : ''}`} />
        <Stat label="Assigned officer" value={application.assignedOfficer?.fullName ?? 'Unassigned'} />
        <Stat label="Credit score" value={application.creditScore != null ? `${application.creditScore} (${application.creditGrade})` : '—'} />
        <Stat label="Submitted" value={application.submittedAt ? formatDateTime(application.submittedAt) : 'Draft'} />
      </div>

      {application.approvedAmountZMW && (
        <div className="card-padded bg-emerald-50 border-emerald-200">
          <h2 className="font-bold text-emerald-800">Approval terms</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3 mt-2 text-sm">
            <div><span className="text-slate-500">Approved amount:</span> <span className="font-semibold">{formatZMW(application.approvedAmountZMW)}</span></div>
            <div><span className="text-slate-500">Approved term:</span> <span className="font-semibold">{application.approvedTermMonths} months</span></div>
            <div><span className="text-slate-500">Approved rate:</span> <span className="font-semibold">{application.approvedRatePct}%</span></div>
          </div>
          {application.loan && (
            <div className="mt-2 text-sm">
              Loan created: <Link href={`/loans/${application.loan.id}`} className="text-brand-700 hover:underline font-mono">{application.loan.loanNo}</Link> ({application.loan.status.replace(/_/g, ' ')})
            </div>
          )}
        </div>
      )}

      {application.rejectionReason && (
        <div className="card-padded bg-red-50 border-red-200">
          <h2 className="font-bold text-red-800">Rejection</h2>
          <p className="text-sm text-slate-700 mt-1">{application.rejectionReason}</p>
        </div>
      )}

      {factors && Array.isArray(factors) && (
        <div className="card-padded">
          <h2 className="font-bold mb-3">Credit score breakdown</h2>
          <table className="table-base">
            <thead><tr><th>Factor</th><th>Weight</th><th>Value</th><th>Contribution</th></tr></thead>
            <tbody>
              {factors.map((f: any, i: number) => (
                <tr key={i}>
                  <td>{f.name}</td>
                  <td>{(f.weight * 100).toFixed(0)}%</td>
                  <td>{f.value?.toFixed?.(0) ?? f.value}</td>
                  <td>{f.contribution?.toFixed?.(1) ?? f.contribution}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="card overflow-x-auto">
        <div className="px-6 py-4 border-b"><h2 className="font-bold">Approval history</h2></div>
        {application.approvals.length === 0 ? (
          <div className="px-6 py-6 text-sm text-slate-500">No decisions recorded yet.</div>
        ) : (
          <table className="table-base responsive-table">
            <thead><tr><th>When</th><th>Level</th><th>Approver</th><th>Decision</th><th>Note</th></tr></thead>
            <tbody>
              {application.approvals.map((a) => (
                <tr key={a.id}>
                  <td className="text-xs">{formatDateTime(a.decidedAt)}</td>
                  <td className="text-xs">{a.level.replace(/_/g, ' ')}</td>
                  <td className="text-xs">{a.approver.fullName}</td>
                  <td>
                    <span className={a.decision === 'APPROVED' ? 'badge-green' : 'badge-red'}>{a.decision}</span>
                  </td>
                  <td className="text-xs">{a.reason || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {session && (
        <ApprovalActions application={application} session={session} />
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card-padded">
      <div className="text-xs text-slate-500 uppercase">{label}</div>
      <div className="text-sm md:text-base font-bold mt-1">{value}</div>
    </div>
  );
}
