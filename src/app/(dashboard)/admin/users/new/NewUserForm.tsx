'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface Branch { id: string; code: string; name: string; }

export default function NewUserForm({ branches }: { branches: Branch[] }) {
  const router = useRouter();
  const [form, setForm] = useState({
    fullName: '',
    email: '',
    phone: '',
    role: 'LOAN_OFFICER',
    branchId: branches[0]?.id ?? '',
    fitProperStatus: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [tempPassword, setTempPassword] = useState<string | null>(null);

  function update<K extends keyof typeof form>(k: K, v: typeof form[K]) {
    setForm((s) => ({ ...s, [k]: v }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setSubmitting(true);
    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, fitProperStatus: form.fitProperStatus || null }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Failed');
        return;
      }
      const data = await res.json();
      setTempPassword(data.tempPassword);
    } catch {
      setError('Failed');
    } finally {
      setSubmitting(false);
    }
  }

  if (tempPassword) {
    return (
      <div className="card-padded shadow-lg space-y-3">
        <h2 className="font-bold text-emerald-700">User created</h2>
        <p className="text-sm">Send these credentials to <strong>{form.email}</strong> by a secure channel. The password is not stored in plain text after creation.</p>
        <div className="bg-slate-50 border border-slate-200 rounded p-3 font-mono text-sm">
          <div><span className="text-slate-500">Email:</span> {form.email}</div>
          <div><span className="text-slate-500">Temporary password:</span> {tempPassword}</div>
        </div>
        <button className="btn btn-secondary" onClick={() => router.push('/admin/users')}>Back to users</button>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="card-padded space-y-4">
      {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>}
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
          <label className="label">Branch *</label>
          <select className="input" value={form.branchId} onChange={(e) => update('branchId', e.target.value)} required>
            {branches.map((b) => (
              <option key={b.id} value={b.id}>{b.code} — {b.name}</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Fit-and-proper status</label>
          <select className="input" value={form.fitProperStatus} onChange={(e) => update('fitProperStatus', e.target.value)}>
            <option value="">Not yet assessed</option>
            <option value="PASSED">Passed</option>
            <option value="PENDING">Pending</option>
            <option value="FAILED">Failed</option>
          </select>
        </div>
      </div>
      <div className="flex justify-end gap-3">
        <button type="button" className="btn btn-secondary" onClick={() => router.back()}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Creating…' : 'Create user'}
        </button>
      </div>
    </form>
  );
}
