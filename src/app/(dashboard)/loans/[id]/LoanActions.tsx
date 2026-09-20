'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface LoanShape {
  id: string;
  status: string;
  disbursedAt: Date | null;
  principalZMW: number;
}

export default function LoanActions({ loan }: { loan: LoanShape }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [channel, setChannel] = useState('MOBILE_MONEY');

  async function call(path: string, body: Record<string, unknown>, key: string) {
    setLoading(key);
    setError(null);
    try {
      const res = await fetch(path, {
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

  return (
    <div className="card-padded">
      <h2 className="font-bold mb-3">Loan actions</h2>
      {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2 mb-3">{error}</div>}

      {loan.status === 'PENDING_DISBURSEMENT' && !loan.disbursedAt && (
        <div className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="label">Disbursement channel</label>
              <select className="input" value={channel} onChange={(e) => setChannel(e.target.value)}>
                <option value="MOBILE_MONEY">Mobile money</option>
                <option value="BANK_TRANSFER">Bank transfer</option>
                <option value="CASH">Cash</option>
              </select>
            </div>
            <button
              className="btn btn-primary"
              disabled={loading !== null}
              onClick={() => call(`/api/loans/${loan.id}/disburse`, { channel }, 'disburse')}
            >
              {loading === 'disburse' ? 'Disbursing…' : `Disburse K${loan.principalZMW.toLocaleString()}`}
            </button>
          </div>
          <p className="text-xs text-slate-500">Disbursement marks the loan as ACTIVE and sets the disbursement date for IFRS 9 stage 1.</p>
        </div>
      )}

      {loan.status === 'ACTIVE' && (
        <div className="flex flex-wrap gap-3">
          <button
            className="btn btn-secondary"
            disabled={loading !== null}
            onClick={() => call(`/api/loans/${loan.id}/restructure`, {}, 'restructure')}
          >
            {loading === 'restructure' ? 'Restructuring…' : 'Restructure loan'}
          </button>
          <button
            className="btn btn-secondary"
            disabled={loading !== null}
            onClick={() => call(`/api/loans/${loan.id}/writeoff`, {}, 'writeoff')}
          >
            {loading === 'writeoff' ? 'Processing…' : 'Mark write-off'}
          </button>
        </div>
      )}
    </div>
  );
}
