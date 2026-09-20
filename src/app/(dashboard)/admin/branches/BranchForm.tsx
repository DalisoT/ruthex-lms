'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export interface BranchInitial {
  name: string;
  code: string;
  province: string;
  city: string;
  address: string;
  phone: string;
  email: string;
  bozBranchCode: string;
  active: boolean;
}

const empty: BranchInitial = {
  name: '', code: '', province: '', city: '', address: '', phone: '', email: '', bozBranchCode: '', active: true,
};

export default function BranchForm({ mode, branchId, initial }: { mode: 'create' | 'edit'; branchId?: string; initial?: BranchInitial }) {
  const router = useRouter();
  const [form, setForm] = useState<BranchInitial>(initial ?? empty);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof BranchInitial>(k: K, v: BranchInitial[K]) {
    setForm((s) => ({ ...s, [k]: v }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setSubmitting(true);
    try {
      const res = await fetch(mode === 'create' ? '/api/admin/branches' : `/api/admin/branches/${branchId}`, {
        method: mode === 'create' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Failed');
        return;
      }
      router.push('/admin/branches');
    } catch {
      setError('Failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card-padded space-y-4">
      {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="label">Branch code *</label>
          <input className="input" required value={form.code} onChange={(e) => update('code', e.target.value)} placeholder="LUSAKA-01" disabled={mode === 'edit'} />
        </div>
        <div>
          <label className="label">Branch name *</label>
          <input className="input" required value={form.name} onChange={(e) => update('name', e.target.value)} />
        </div>
        <div>
          <label className="label">Province</label>
          <input className="input" value={form.province} onChange={(e) => update('province', e.target.value)} />
        </div>
        <div>
          <label className="label">City</label>
          <input className="input" value={form.city} onChange={(e) => update('city', e.target.value)} />
        </div>
        <div className="md:col-span-2">
          <label className="label">Address</label>
          <input className="input" value={form.address} onChange={(e) => update('address', e.target.value)} />
        </div>
        <div>
          <label className="label">Phone</label>
          <input className="input" value={form.phone} onChange={(e) => update('phone', e.target.value)} />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" value={form.email} onChange={(e) => update('email', e.target.value)} />
        </div>
        <div>
          <label className="label">BOZ branch code</label>
          <input className="input" value={form.bozBranchCode} onChange={(e) => update('bozBranchCode', e.target.value)} placeholder="LUS-MAIN" />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.active} onChange={(e) => update('active', e.target.checked)} />
        Branch is active (visible to borrowers and loan officers)
      </label>
      <div className="flex justify-end gap-3">
        <button type="button" className="btn btn-secondary" onClick={() => router.back()}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Saving…' : mode === 'create' ? 'Create branch' : 'Save changes'}
        </button>
      </div>
    </form>
  );
}
