'use client';

import { useState } from 'react';

export default function ResetPasswordButton({ userId, email }: { userId: string; email: string }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState<string | null>(null);

  async function reset() {
    if (!confirm(`Reset password for ${email}? A new temporary password will be generated.`)) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch(`/api/admin/users/${userId}/reset-password`, { method: 'POST' });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Failed');
        return;
      }
      const data = await res.json();
      setNewPassword(data.tempPassword);
    } catch {
      setError('Failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="card-padded space-y-3">
      <h2 className="font-bold">Password</h2>
      <p className="text-sm text-slate-600">Resetting a password invalidates all active sessions for this user and issues a new temporary password.</p>
      {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>}
      {newPassword ? (
        <div className="bg-slate-50 border border-slate-200 rounded p-3 font-mono text-sm space-y-1">
          <div><span className="text-slate-500">Email:</span> {email}</div>
          <div><span className="text-slate-500">New temporary password:</span> {newPassword}</div>
          <div className="text-xs text-amber-700 mt-2">Send this through a secure channel. The user must change it on first login.</div>
        </div>
      ) : (
        <button className="btn btn-secondary" disabled={loading} onClick={reset}>
          {loading ? 'Resetting…' : 'Reset password'}
        </button>
      )}
    </div>
  );
}
