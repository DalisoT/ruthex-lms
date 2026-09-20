'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function RecordRepaymentForm({ loanId, outstanding }: { loanId: string; outstanding: number }) {
  const router = useRouter();
  const [amount, setAmount] = useState(outstanding > 0 ? outstanding.toFixed(2) : '');
  const [method, setMethod] = useState('CASH');
  const [channel, setChannel] = useState('');
  const [msisdn, setMsisdn] = useState('');
  const [paidByName, setPaidByName] = useState('');
  const [paidByRelation, setPaidByRelation] = useState('');
  const [notes, setNotes] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setSuccess(null); setSubmitting(true);
    try {
      const res = await fetch('/api/repayments', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          loanId,
          totalPaidZMW: Number(amount),
          paymentMethod: method,
          paymentChannel: channel || null,
          msisdn: msisdn || null,
          paidByName: paidByName || null,
          paidByRelation: paidByRelation || null,
          notes: notes || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Failed to record repayment');
        return;
      }
      const data = await res.json();
      setSuccess(`Receipt ${data.receiptNo} posted. New balance: K${data.newOutstanding.toFixed(2)}.${data.ctrTriggered ? ' CTR alert opened.' : ''}${data.strTriggered ? ' STR alert opened.' : ''}`);
      setTimeout(() => router.refresh(), 600);
    } catch {
      setError('Failed to record repayment');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card-padded space-y-4">
      <h2 className="font-bold">Record repayment</h2>
      {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>}
      {success && <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-3 py-2">{success}</div>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="label">Amount (ZMW)</label>
          <input className="input" type="number" step="0.01" min={0.01} required value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <div>
          <label className="label">Payment method</label>
          <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>
            <option value="CASH">Cash</option>
            <option value="MOBILE_MONEY">Mobile money</option>
            <option value="BANK_TRANSFER">Bank transfer</option>
            <option value="CHEQUE">Cheque</option>
            <option value="OFFSET">Offset (write-down)</option>
          </select>
        </div>
        {method === 'MOBILE_MONEY' && (
          <>
            <div>
              <label className="label">Provider</label>
              <select className="input" value={channel} onChange={(e) => setChannel(e.target.value)}>
                <option value="">Select</option>
                <option value="MTN">MTN MoMo</option>
                <option value="AIRTEL">Airtel Money</option>
                <option value="ZAMTEL">Zamtel Money</option>
                <option value="MOCK">Mock / sandbox</option>
              </select>
            </div>
            <div>
              <label className="label">MSISDN</label>
              <input className="input" placeholder="260971234567" value={msisdn} onChange={(e) => setMsisdn(e.target.value)} />
            </div>
          </>
        )}
        <div>
          <label className="label">Paid by (if not borrower)</label>
          <input className="input" placeholder="Optional" value={paidByName} onChange={(e) => setPaidByName(e.target.value)} />
        </div>
        <div>
          <label className="label">Relationship to borrower</label>
          <input className="input" placeholder="e.g. employer, spouse" value={paidByRelation} onChange={(e) => setPaidByRelation(e.target.value)} />
        </div>
      </div>
      <div>
        <label className="label">Notes</label>
        <textarea className="input" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
      </div>
      <div className="flex justify-end gap-3">
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Posting…' : 'Post receipt'}
        </button>
      </div>
    </form>
  );
}
