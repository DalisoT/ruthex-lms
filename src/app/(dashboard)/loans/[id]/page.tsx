import { sql, eq, desc, asc, and, or, inArray, ne, gte, lte, gt, lt, isNull, like, ilike } from 'drizzle-orm';
import { db, prisma } from '@/lib/db';
import { borrowers, loans, repayments, amlAlerts, auditLogs, users, branches, loanApplications, loanProducts, notifications } from '@/lib/db/schema';

import { notFound } from 'next/navigation';
import Link from 'next/link';
import { formatZMW, formatDate } from '@/lib/utils';
import LoanActions from './LoanActions';
import RecordRepaymentForm from './RecordRepaymentForm';

export const metadata = { title: 'Loan — RUTHEX' };

export default async function LoanDetailPage({ params }: { params: { id: string } }) {
  const loan = await prisma.loan.findUnique({
    where: { id: params.id },
    include: {
      borrower: true,
      product: true,
      schedule: { orderBy: { installmentNo: 'asc' } },
      repayments: { orderBy: { receivedAt: 'desc' }, include: { recordedBy: { select: { fullName: true } } } },
      application: true,
    },
  });
  if (!loan) notFound();

  const paidInstallments = loan.schedule.filter((s: any) => s.status === 'PAID').length;
  const totalPaid = loan.repayments.reduce((s: any, r: any) => s + r.totalPaidZMW, 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/loans" className="text-sm text-brand-700 hover:underline">← Loans</Link>
          <h1 className="text-2xl font-bold mt-1">{loan.loanNo}</h1>
          <p className="text-sm text-slate-500">
            <Link href={`/borrowers/${loan.borrowerId}`} className="text-brand-700 hover:underline">
              {loan.borrower.firstName} {loan.borrower.lastName}
            </Link>
            {' '}· {loan.borrower.borrowerNo} · {loan.product.name}
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <span className={
            loan.status === 'ACTIVE' ? 'badge-green'
            : loan.status === 'IN_ARREARS' ? 'badge-amber'
            : loan.status === 'PENDING_DISBURSEMENT' ? 'badge-blue'
            : loan.status === 'DEFAULTED' || loan.status === 'WRITTEN_OFF' ? 'badge-red'
            : 'badge-gray'
          }>{loan.status.replace(/_/g, ' ')}</span>
          {loan.ifrs9Stage === 3 && <span className="badge-red">Stage 3 (NPL)</span>}
          {loan.ifrs9Stage === 2 && <span className="badge-amber">Stage 2</span>}
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat label="Principal" value={formatZMW(loan.principalZMW)} />
        <Stat label="Total repayable" value={formatZMW(loan.totalRepayableZMW)} />
        <Stat label="Outstanding" value={formatZMW(loan.totalOutstandingZMW)} tone={loan.totalOutstandingZMW > 0 ? 'red' : 'green'} />
        <Stat label="Interest rate" value={`${loan.interestRateAnnualPct}% (${loan.interestMethod.replace('_', '-').toLowerCase()})`} />
        <Stat label="Term" value={`${loan.termMonths} months`} />
        <Stat label="Installment" value={formatZMW(loan.installmentZMW)} />
        <Stat label="Disbursed" value={loan.disbursedAt ? formatDate(loan.disbursedAt) : 'Pending'} />
        <Stat label="Days in arrears" value={`${loan.daysInArrears}d`} tone={loan.daysInArrears > 0 ? 'red' : 'green'} />
      </div>

      <LoanActions loan={loan} />

      <RecordRepaymentForm loanId={loan.id} outstanding={loan.totalOutstandingZMW} />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b">
            <h2 className="font-bold">Repayment schedule ({paidInstallments}/{loan.schedule.length} paid)</h2>
          </div>
          <div className="overflow-x-auto max-h-[480px]">
            <table className="table-base responsive-table">
              <thead className="sticky top-0 bg-slate-50">
                <tr>
                  <th>#</th><th>Due</th><th>Total</th><th>Status</th>
                </tr>
              </thead>
              <tbody>
                {loan.schedule.map((s: any) => (
                  <tr key={s.id}>
                    <td>{s.installmentNo}</td>
                    <td className="text-xs">{formatDate(s.dueDate)}</td>
                    <td>{formatZMW(s.totalDue)}</td>
                    <td>
                      <span className={
                        s.status === 'PAID' ? 'badge-green'
                        : s.status === 'OVERDUE' ? 'badge-red'
                        : s.status === 'PARTIAL' ? 'badge-amber'
                        : 'badge-gray'
                      }>{s.status}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="card overflow-hidden">
          <div className="px-6 py-4 border-b">
            <h2 className="font-bold">Repayment history ({totalPaid > 0 ? formatZMW(totalPaid) + ' received' : 'No receipts yet'})</h2>
          </div>
          {loan.repayments.length === 0 ? (
            <div className="px-6 py-6 text-sm text-slate-500">No repayments recorded yet.</div>
          ) : (
            <div className="overflow-x-auto max-h-[480px]">
              <table className="table-base responsive-table">
                <thead className="sticky top-0 bg-slate-50">
                  <tr>
                    <th>Receipt</th><th>Date</th><th>Method</th><th>Total</th>
                  </tr>
                </thead>
                <tbody>
                  {loan.repayments.map((r: any) => (
                    <tr key={r.id}>
                      <td className="font-mono text-xs">{r.receiptNo}</td>
                      <td className="text-xs">{formatDate(r.receivedAt)}</td>
                      <td>
                        <span className="badge-blue">{r.paymentMethod.replace('_', ' ')}</span>
                        {r.paymentChannel && <span className="text-xs text-slate-500 ml-1">{r.paymentChannel}</span>}
                      </td>
                      <td>{formatZMW(r.totalPaidZMW)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'red' | 'green' }) {
  const c = tone === 'green' ? 'text-emerald-700' : tone === 'red' ? 'text-red-700' : 'text-slate-900';
  return (
    <div className="card-padded">
      <div className="text-xs text-slate-500 uppercase">{label}</div>
      <div className={`text-lg md:text-xl font-bold mt-1 ${c}`}>{value}</div>
    </div>
  );
}
