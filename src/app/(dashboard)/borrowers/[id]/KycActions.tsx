'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function KycActions({ borrowerId, status }: { borrowerId: string; status: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function decide(decision: 'APPROVED' | 'REJECTED') {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/borrowers/${borrowerId}/kyc`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, notes: '' }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Decision failed');
        return;
      }
      router.refresh();
    } catch {
      setError('Decision failed');
    } finally {
      setLoading(false);
    }
  }

  if (status === 'APPROVED' || status === 'REJECTED') {
    return (
      <div className="card-padded bg-slate-50">
        <h2 className="font-bold mb-2">KYC review</h2>
        <p className="text-sm text-slate-600">KYC {status.toLowerCase()}. To re-review, contact compliance.</p>
      </div>
    );
  }

  return (
    <div className="card-padded">
      <h2 className="font-bold mb-3">KYC review</h2>
      {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2 mb-3">{error}</div>}
      <div className="flex flex-wrap gap-3">
        <button className="btn btn-primary" disabled={loading} onClick={() => decide('APPROVED')}>
          Approve KYC
        </button>
        <button className="btn btn-danger" disabled={loading} onClick={() => decide('REJECTED')}>
          Reject KYC
        </button>
      </div>
      <p className="text-xs text-slate-500 mt-3">
        Approving sets borrower&apos;s KYC status to APPROVED and rating to LOW (or HIGH if PEP). Rejecting sets status to REJECTED.
      </p>
    </div>
  );
}
