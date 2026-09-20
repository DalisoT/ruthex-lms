'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface ApplicationShape {
  id: string;
  status: string;
  requestedAmountZMW: number;
  requestedTermMonths: number;
  productId: string;
  borrowerId: string;
  product: { interestRateAnnualPct: number };
}

interface UserSession { userId: string; role: string; }

export default function ApprovalActions({ application, session }: { application: ApplicationShape; session: UserSession }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [reason, setReason] = useState('');
  const [approvedAmount, setApprovedAmount] = useState(application.requestedAmountZMW.toString());
  const [approvedTerm, setApprovedTerm] = useState(application.requestedTermMonths.toString());
  const [approvedRate, setApprovedRate] = useState(application.product.interestRateAnnualPct.toString());

  async function decide(decision: 'APPROVED' | 'REJECTED') {
    setLoading(decision);
    setError(null);
    try {
      const body: Record<string, unknown> = { decision, reason };
      if (decision === 'APPROVED') {
        body.approvedAmountZMW = Number(approvedAmount);
        body.approvedTermMonths = Number(approvedTerm);
        body.approvedRatePct = Number(approvedRate);
      }
      const res = await fetch(`/api/loans/applications/${application.id}/decide`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Action failed');
        return;
      }
      router.refresh();
    } catch {
      setError('Action failed');
    } finally {
      setLoading(null);
    }
  }

  // Only show actions for users with lending roles and applications that need decision
  if (application.status !== 'UNDER_REVIEW') return null;
  const canDecide = ['ADMIN', 'BRANCH_MANAGER', 'CREDIT_OFFICER'].includes(session.role);
  if (!canDecide) return null;

  return (
    <div className="card-padded space-y-4">
      <h2 className="font-bold">Approval decision</h2>
      {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div>
          <label className="label">Approved amount (ZMW)</label>
          <input className="input" type="number" value={approvedAmount} onChange={(e) => setApprovedAmount(e.target.value)} />
        </div>
        <div>
          <label className="label">Approved term (months)</label>
          <input className="input" type="number" value={approvedTerm} onChange={(e) => setApprovedTerm(e.target.value)} />
        </div>
        <div>
          <label className="label">Approved rate (% p.a.)</label>
          <input className="input" type="number" step="0.01" value={approvedRate} onChange={(e) => setApprovedRate(e.target.value)} />
        </div>
      </div>
      <div>
        <label className="label">Decision notes</label>
        <textarea className="input" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Justification, conditions, references checked…" />
      </div>
      <div className="flex gap-3">
        <button className="btn btn-primary" disabled={loading !== null} onClick={() => decide('APPROVED')}>
          {loading === 'APPROVED' ? 'Approving…' : 'Approve application'}
        </button>
        <button className="btn btn-danger" disabled={loading !== null} onClick={() => decide('REJECTED')}>
          {loading === 'REJECTED' ? 'Rejecting…' : 'Reject application'}
        </button>
      </div>
      <p className="text-xs text-slate-500">Approval records a multi-level audit entry. The loan record and amortization schedule are created on approval and visible on the Loans tab.</p>
    </div>
  );
}
