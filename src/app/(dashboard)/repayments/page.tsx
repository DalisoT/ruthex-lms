import { prisma } from '@/lib/db';
import Link from 'next/link';
import { formatZMW, formatDate } from '@/lib/utils';

export const metadata = { title: 'Repayments — RUTHEX' };

interface SearchParams { q?: string; method?: string; page?: string }

export default async function RepaymentsListPage({ searchParams }: { searchParams: SearchParams }) {
  const q = (searchParams.q ?? '').trim();
  const method = searchParams.method;
  const page = Math.max(1, parseInt(searchParams.page ?? '1', 10) || 1);
  const PAGE_SIZE = 30;
  const where = {
    AND: [
      q ? {
        OR: [
          { receiptNo: { contains: q } },
          { loan: { loanNo: { contains: q } } },
          { loan: { borrower: { firstName: { contains: q } } } },
          { loan: { borrower: { lastName: { contains: q } } } },
          { loan: { borrower: { borrowerNo: { contains: q } } } },
        ],
      } : {},
      method ? { paymentMethod: method as any } : {},
    ],
  };

  const [total, repayments, todayTotal, ctrFlagged, strFlagged] = await Promise.all([
    prisma.repayment.count({ where }),
    prisma.repayment.findMany({
      where,
      include: {
        loan: { include: { borrower: { select: { firstName: true, lastName: true, borrowerNo: true } } } },
        recordedBy: { select: { fullName: true } },
      },
      orderBy: { receivedAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    prisma.repayment.aggregate({ _sum: { totalPaidZMW: true }, where: { receivedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
    prisma.repayment.count({ where: { triggersCtr: true, receivedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
    prisma.repayment.count({ where: { triggersStr: true, receivedAt: { gte: new Date(new Date().setHours(0, 0, 0, 0)) } } }),
  ]);
  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Repayments</h1>
        <p className="text-sm text-slate-500">Cash, mobile money, bank transfer — every receipt posted into the book.</p>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <div className="card-padded">
          <div className="text-xs text-slate-500 uppercase">Today&apos;s receipts</div>
          <div className="text-2xl font-bold mt-1">{formatZMW(todayTotal._sum.totalPaidZMW ?? 0)}</div>
        </div>
        <div className="card-padded">
          <div className="text-xs text-slate-500 uppercase">CTR flagged today</div>
          <div className="text-2xl font-bold mt-1 text-amber-700">{ctrFlagged}</div>
        </div>
        <div className="card-padded">
          <div className="text-xs text-slate-500 uppercase">STR flagged today</div>
          <div className="text-2xl font-bold mt-1 text-red-700">{strFlagged}</div>
        </div>
      </div>

      <form className="card p-4 flex flex-wrap items-end gap-3" method="get">
        <div className="flex-1 min-w-[200px]">
          <label className="label">Search</label>
          <input className="input" name="q" defaultValue={q} placeholder="Receipt #, loan #, borrower…" />
        </div>
        <div>
          <label className="label">Method</label>
          <select className="input" name="method" defaultValue={method ?? ''}>
            <option value="">All</option>
            <option value="CASH">Cash</option>
            <option value="MOBILE_MONEY">Mobile money</option>
            <option value="BANK_TRANSFER">Bank transfer</option>
            <option value="CHEQUE">Cheque</option>
            <option value="OFFSET">Offset</option>
          </select>
        </div>
        <button className="btn btn-secondary">Apply</button>
      </form>

      <div className="card overflow-x-auto">
        <table className="table-base responsive-table">
          <thead>
            <tr>
              <th>Receipt</th>
              <th>Loan / Borrower</th>
              <th>Date</th>
              <th>Method</th>
              <th className="text-right">Total</th>
              <th>AML</th>
              <th>By</th>
            </tr>
          </thead>
          <tbody>
            {repayments.length === 0 ? (
              <tr><td colSpan={7} className="text-center py-8 text-slate-500">No receipts match the filter.</td></tr>
            ) : repayments.map((r) => (
              <tr key={r.id}>
                <td className="font-mono text-xs">{r.receiptNo}</td>
                <td>
                  <Link href={`/loans/${r.loanId}`} className="text-brand-700 hover:underline font-mono text-xs">{r.loan.loanNo}</Link>
                  <div className="text-sm">{r.loan.borrower.firstName} {r.loan.borrower.lastName}</div>
                  <div className="text-xs text-slate-500 font-mono">{r.loan.borrower.borrowerNo}</div>
                </td>
                <td className="text-xs">{formatDate(r.receivedAt)}</td>
                <td>
                  <span className="badge-blue">{r.paymentMethod.replace('_', ' ')}</span>
                  {r.paymentChannel && <div className="text-xs text-slate-500 mt-1">{r.paymentChannel}</div>}
                </td>
                <td className="text-right font-semibold">{formatZMW(r.totalPaidZMW)}</td>
                <td>
                  {r.triggersCtr && <span className="badge-amber mr-1">CTR</span>}
                  {r.triggersStr && <span className="badge-red">STR</span>}
                  {!r.triggersCtr && !r.triggersStr && <span className="text-slate-400 text-xs">—</span>}
                </td>
                <td className="text-xs">{r.recordedBy.fullName}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <div className="text-slate-500">{total} receipt{total === 1 ? '' : 's'} · page {page} of {totalPages}</div>
          <div className="space-x-2">
            {page > 1 && <Link href={`?${new URLSearchParams({ ...searchParams, page: String(page - 1) })}`} className="btn btn-secondary">← Prev</Link>}
            {page < totalPages && <Link href={`?${new URLSearchParams({ ...searchParams, page: String(page + 1) })}`} className="btn btn-secondary">Next →</Link>}
          </div>
        </div>
      )}
    </div>
  );
}
