import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { getCurrentSession } from '@/lib/auth';
import { formatZMW, formatDate } from '@/lib/utils';
import PrintButton from './PrintButton';

export const metadata = { title: 'Statement — RUTHEX' };

export default async function StatementPage({ params }: { params: { id: string } }) {
  const session = await getCurrentSession();
  const borrower = await prisma.borrower.findUnique({
    where: { id: params.id },
    include: {
      loans: {
        where: { status: { in: ['ACTIVE', 'IN_ARREARS', 'RESTRUCTURED', 'PENDING_DISBURSEMENT', 'CLOSED'] } },
        include: {
          schedule: { orderBy: { installmentNo: 'asc' } },
          repayments: { orderBy: { receivedAt: 'desc' } },
          product: true,
        },
        orderBy: { createdAt: 'desc' },
      },
    },
  });
  if (!borrower) notFound();

  const totalDisbursed = borrower.loans.reduce((s, l) => s + l.principalZMW, 0);
  const totalRepaid = borrower.loans.reduce((s, l) => s + l.repayments.reduce((r, p) => r + p.totalPaidZMW, 0), 0);
  const totalOutstanding = borrower.loans.reduce((s, l) => s + l.totalOutstandingZMW, 0);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3 no-print">
        <div>
          <Link href={`/borrowers/${borrower.id}`} className="text-sm text-brand-700 hover:underline">← {borrower.firstName} {borrower.lastName}</Link>
          <h1 className="text-2xl font-bold mt-1">Borrower statement</h1>
          <p className="text-sm text-slate-500 font-mono">{borrower.borrowerNo} · {borrower.firstName} {borrower.lastName}</p>
        </div>
        <div className="flex gap-2">
          <PrintButton />
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <Stat label="Total disbursed" value={formatZMW(totalDisbursed)} />
        <Stat label="Total repaid" value={formatZMW(totalRepaid)} />
        <Stat label="Outstanding" value={formatZMW(totalOutstanding)} tone={totalOutstanding > 0 ? 'red' : 'green'} />
      </div>

      {borrower.loans.length === 0 ? (
        <div className="card-padded text-center text-slate-500">No loans on file.</div>
      ) : borrower.loans.map((loan) => (
        <div key={loan.id} className="space-y-3">
          <div className="card-padded">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-bold">{loan.product.name}</h2>
                <div className="text-xs text-slate-500 font-mono">{loan.loanNo} · {loan.interestRateAnnualPct}% p.a. · {loan.termMonths}m</div>
              </div>
              <div className="text-right">
                <div className="text-xs text-slate-500">Disbursed {loan.disbursedAt ? formatDate(loan.disbursedAt) : '—'}</div>
                <div className="font-semibold">{formatZMW(loan.totalOutstandingZMW)} <span className="text-xs text-slate-500">outstanding</span></div>
              </div>
            </div>
          </div>
          <div className="card overflow-hidden">
            <div className="px-6 py-3 border-b bg-slate-50">
              <h3 className="text-sm font-bold uppercase tracking-wide">Repayment schedule</h3>
            </div>
            <table className="table-base responsive-table">
              <thead>
                <tr><th>#</th><th>Due</th><th>Principal</th><th>Interest</th><th>Total</th><th>Status</th></tr>
              </thead>
              <tbody>
                {loan.schedule.map((s) => (
                  <tr key={s.id}>
                    <td>{s.installmentNo}</td>
                    <td className="text-xs">{formatDate(s.dueDate)}</td>
                    <td>{formatZMW(s.principalDue)}</td>
                    <td>{formatZMW(s.interestDue)}</td>
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
          {loan.repayments.length > 0 && (
            <div className="card overflow-hidden">
              <div className="px-6 py-3 border-b bg-slate-50">
                <h3 className="text-sm font-bold uppercase tracking-wide">Repayments</h3>
              </div>
              <table className="table-base responsive-table">
                <thead><tr><th>Receipt</th><th>Date</th><th>Method</th><th className="text-right">Total</th></tr></thead>
                <tbody>
                  {loan.repayments.map((r) => (
                    <tr key={r.id}>
                      <td className="font-mono text-xs">{r.receiptNo}</td>
                      <td className="text-xs">{formatDate(r.receivedAt)}</td>
                      <td className="text-xs">{r.paymentMethod.replace(/_/g, ' ')}{r.paymentChannel ? ` · ${r.paymentChannel}` : ''}</td>
                      <td className="text-right">{formatZMW(r.totalPaidZMW)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ))}
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
