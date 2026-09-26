'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Branch { id: string; code: string; name: string; }
interface Initial {
  fullName: string; email: string; phone: string;
  role: string; branchId: string; fitProperStatus: string; active: boolean;
}

export default function EditUserForm({ userId, initial, branches }: { userId: string; initial: Initial | any; branches: Branch[] | any[] }) {
  const router = useRouter();
  const [form, setForm] = useState<Initial>(initial);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function update<K extends keyof Initial>(k: K, v: Initial[K]) {
    setForm((s) => ({ ...s, [k]: v }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setSuccess(false); setSubmitting(true);
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: form.fullName, email: form.email, phone: form.phone,
          role: form.role, branchId: form.branchId || null,
          fitProperStatus: form.fitProperStatus || null, active: form.active,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Failed');
        return;
      }
      setSuccess(true);
      router.refresh();
    } catch {
      setError('Failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card-padded space-y-4">
      <h2 className="font-bold">Account</h2>
      {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>}
      {success && <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-3 py-2">Saved.</div>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="label">Full name *</label>
          <input className="input" required value={form.fullName} onChange={(e) => update('fullName', e.target.value)} />
        </div>
        <div>
          <label className="label">Email *</label>
          <input className="input" type="email" required value={form.email} onChange={(e) => update('email', e.target.value)} />
        </div>
        <div>
          <label className="label">Phone</label>
          <input className="input" value={form.phone} onChange={(e) => update('phone', e.target.value)} />
        </div>
        <div>
          <label className="label">Role *</label>
          <select className="input" value={form.role} onChange={(e) => update('role', e.target.value)}>
            <option value="ADMIN">Administrator</option>
            <option value="BRANCH_MANAGER">Branch Manager</option>
            <option value="CREDIT_OFFICER">Credit Officer</option>
            <option value="LOAN_OFFICER">Loan Officer</option>
            <option value="CASHIER">Cashier</option>
            <option value="COMPLIANCE_OFFICER">Compliance Officer</option>
            <option value="AUDITOR">Auditor</option>
          </select>
        </div>
        <div>
          <label className="label">Branch</label>
          <select className="input" value={form.branchId} onChange={(e) => update('branchId', e.target.value)}>
            <option value="">— None —</option>
            {branches.map((b: any) => (
              <option key={b.id} value={b.id}>{b.code} — {b.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Fit-and-proper status</label>
          <select className="input" value={form.fitProperStatus} onChange={(e) => update('fitProperStatus', e.target.value)}>
            <option value="">Not assessed</option>
            <option value="PASSED">Passed</option>
            <option value="PENDING">Pending</option>
            <option value="FAILED">Failed</option>
          </select>
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.active} onChange={(e) => update('active', e.target.checked)} />
        Account is active (disable to revoke access without deleting)
      </label>
      <div className="flex justify-end gap-3">
        <button type="button" className="btn btn-secondary" onClick={() => router.back()}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  );
}
