'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function AmlActions({ alertId, status }: { alertId: string; status: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  async function call(action: string, body: Record<string, unknown> = {}) {
    setLoading(action);
    setError(null);
    try {
      const res = await fetch(`/api/aml/${alertId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, notes, ...body }),
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

  if (status === 'DISMISSED' || status === 'REPORTED_TO_FIC') {
    return (
      <div className="card-padded bg-slate-50">
        <h2 className="font-bold mb-2">Resolution</h2>
        <p className="text-sm">Status: <span className="font-medium">{status.replace(/_/g, ' ')}</span></p>
      </div>
    );
  }

  return (
    <div className="card-padded space-y-3">
      <h2 className="font-bold">Compliance action</h2>
      {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>}
      <div>
        <label className="label">Notes</label>
        <textarea className="input" rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Investigation notes, justification for dismissal or escalation…" />
      </div>
      <div className="flex flex-wrap gap-3">
        <button className="btn btn-secondary" disabled={loading !== null} onClick={() => call('investigate')}>
          {loading === 'investigate' ? 'Updating…' : 'Mark investigating'}
        </button>
        <button className="btn btn-primary" disabled={loading !== null} onClick={() => call('report_to_fic')}>
          {loading === 'report_to_fic' ? 'Filing…' : 'Mark reported to FIC'}
        </button>
        <button className="btn btn-danger" disabled={loading !== null} onClick={() => call('dismiss')}>
          {loading === 'dismiss' ? 'Dismissing…' : 'Dismiss alert'}
        </button>
      </div>
    </div>
  );
}
