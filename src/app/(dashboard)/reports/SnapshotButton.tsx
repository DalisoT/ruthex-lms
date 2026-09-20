'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface ReportPayload {
  type: 'CAPITAL_ADEQUACY' | 'LIQUIDITY' | 'ASSET_QUALITY' | 'LARGE_EXPOSURES' | 'RELATED_PARTY' | 'MONTHLY_PRUDENTIAL';
  payload: Record<string, unknown>;
}

export default function SnapshotButton({
  reports, periodStart, periodEnd,
}: { reports: ReportPayload[]; periodStart: string; periodEnd: string }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function snapshot() {
    setLoading(true); setError(null); setSuccess(null);
    try {
      const res = await fetch('/api/reports/snapshot', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reports, periodStart, periodEnd }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Snapshot failed');
        return;
      }
      const data = await res.json();
      setSuccess(`${data.count} snapshot${data.count === 1 ? '' : 's'} persisted.`);
      setTimeout(() => router.refresh(), 500);
    } catch {
      setError('Snapshot failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card-padded flex flex-wrap items-center justify-between gap-3">
      <div className="text-sm text-slate-600">
        <strong className="text-slate-900">Snapshot this period</strong> persists figures for BOZ submission and audit.
      </div>
      <div className="flex items-center gap-3">
        {error && <span className="text-sm text-red-700">{error}</span>}
        {success && <span className="text-sm text-emerald-700">{success}</span>}
        <button className="btn btn-primary" onClick={snapshot} disabled={loading}>
          {loading ? 'Saving…' : 'Snapshot this period'}
        </button>
      </div>
    </div>
  );
}
