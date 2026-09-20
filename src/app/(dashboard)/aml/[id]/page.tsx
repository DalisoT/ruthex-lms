import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { formatDate } from '@/lib/utils';
import AmlActions from './AmlActions';

export const metadata = { title: 'AML Alert — RUTHEX' };

export default async function AmlAlertPage({ params }: { params: { id: string } }) {
  const alert = await prisma.amlAlert.findUnique({
    where: { id: params.id },
    include: {
      borrower: true,
      loan: { include: { borrower: true } },
      ctrRecord: true,
      strRecord: true,
    },
  });
  if (!alert) notFound();

  const evidence = alert.evidenceJson ? JSON.parse(alert.evidenceJson) : null;

  return (
    <div className="space-y-4">
      <div>
        <Link href="/aml" className="text-sm text-brand-700 hover:underline">← AML alerts</Link>
        <h1 className="text-2xl font-bold mt-1">{alert.alertType} alert — {alert.ruleCode}</h1>
        <p className="text-sm text-slate-500">Opened {formatDate(alert.triggeredAt)} · severity {alert.severity}</p>
      </div>

      <div className="card-padded">
        <h2 className="font-bold mb-2">Description</h2>
        <p className="text-sm">{alert.description}</p>
      </div>

      {alert.borrower && (
        <div className="card-padded">
          <h2 className="font-bold mb-2">Subject</h2>
          <Link href={`/borrowers/${alert.borrower.id}`} className="text-brand-700 hover:underline">
            {alert.borrower.firstName} {alert.borrower.lastName}
          </Link>
          <div className="text-xs text-slate-500 font-mono">{alert.borrower.borrowerNo} · NRC {alert.borrower.nrcNumber ?? '—'} · {alert.borrower.phone}</div>
        </div>
      )}

      {evidence && (
        <div className="card-padded">
          <h2 className="font-bold mb-2">Evidence</h2>
          <pre className="bg-slate-50 rounded p-3 text-xs overflow-x-auto">{JSON.stringify(evidence, null, 2)}</pre>
        </div>
      )}

      {alert.ctrRecord && (
        <div className="card-padded">
          <h2 className="font-bold mb-2">CTR record</h2>
          <div className="text-sm space-y-1">
            <div><span className="text-slate-500">Customer:</span> {alert.ctrRecord.customerName}</div>
            <div><span className="text-slate-500">NRC:</span> {alert.ctrRecord.customerNrc ?? '—'}</div>
            <div><span className="text-slate-500">Amount:</span> K{alert.ctrRecord.amountZMW.toFixed(2)} (~USD {alert.ctrRecord.amountUSD.toFixed(0)})</div>
            <div><span className="text-slate-500">Date:</span> {formatDate(alert.ctrRecord.transactionDate)}</div>
            <div><span className="text-slate-500">Status:</span> {alert.ctrRecord.status}</div>
          </div>
        </div>
      )}

      {alert.strRecord && (
        <div className="card-padded">
          <h2 className="font-bold mb-2">STR record</h2>
          <div className="text-sm space-y-1">
            <div><span className="text-slate-500">Subject:</span> {alert.strRecord.subjectName}</div>
            <div><span className="text-slate-500">Suspicion:</span> {alert.strRecord.suspicionSummary}</div>
            <div><span className="text-slate-500">Filing deadline:</span> {alert.strRecord.filingDeadline ? formatDate(alert.strRecord.filingDeadline) : '—'}</div>
            <div><span className="text-slate-500">Status:</span> {alert.strRecord.status}</div>
          </div>
        </div>
      )}

      <AmlActions alertId={alert.id} status={alert.status} />
    </div>
  );
}
