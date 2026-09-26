'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export interface ProductInitial {
  name: string;
  description: string;
  interestRateAnnualPct: number;
  interestMethod: 'FLAT' | 'REDUCING_BALANCE' | 'COMPOUND';
  minTermMonths: number;
  maxTermMonths: number;
  minAmountZMW: number;
  maxAmountZMW: number;
  disbursementChannels: string;
  repaymentFrequency: 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'LUMP_SUM';
  gracePeriodDays: number;
  applicationFeeZMW: number;
  processingFeePct: number;
  requiresCollateral: boolean;
  active: boolean;
}

const empty: ProductInitial = {
  name: '', description: '',
  interestRateAnnualPct: 36, interestMethod: 'REDUCING_BALANCE',
  minTermMonths: 1, maxTermMonths: 12,
  minAmountZMW: 1000, maxAmountZMW: 100_000,
  disbursementChannels: 'MOBILE_MONEY,CASH',
  repaymentFrequency: 'MONTHLY', gracePeriodDays: 0,
  applicationFeeZMW: 0, processingFeePct: 0,
  requiresCollateral: false, active: true,
};

export default function ProductForm({
  mode, productId, initial,
}: {
  mode: 'create' | 'edit';
  productId?: string;
  initial?: ProductInitial | any;
}) {
  const router = useRouter();
  const [form, setForm] = useState<ProductInitial>(initial ?? empty);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  function update<K extends keyof ProductInitial>(k: K, v: ProductInitial[K]) {
    setForm((s) => ({ ...s, [k]: v }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setSuccess(false); setSubmitting(true);
    try {
      const res = await fetch(mode === 'create' ? '/api/admin/products' : `/api/admin/products/${productId}`, {
        method: mode === 'create' ? 'POST' : 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Failed');
        return;
      }
      setSuccess(true);
      router.push('/admin/products');
    } catch {
      setError('Failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card-padded space-y-4">
      {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>}
      {success && <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded px-3 py-2">Saved.</div>}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="md:col-span-2">
          <label className="label">Name *</label>
          <input className="input" required value={form.name} onChange={(e) => update('name', e.target.value)} placeholder="e.g. Payday Loan" />
        </div>
        <div className="md:col-span-2">
          <label className="label">Description</label>
          <textarea className="input" rows={2} value={form.description} onChange={(e) => update('description', e.target.value)} />
        </div>
        <div>
          <label className="label">Interest rate (% per annum)</label>
          <input className="input" type="number" step="0.01" required value={form.interestRateAnnualPct} onChange={(e) => update('interestRateAnnualPct', Number(e.target.value))} />
        </div>
        <div>
          <label className="label">Interest method</label>
          <select className="input" value={form.interestMethod} onChange={(e) => update('interestMethod', e.target.value as any)}>
            <option value="FLAT">Flat</option>
            <option value="REDUCING_BALANCE">Reducing balance</option>
            <option value="COMPOUND">Compound</option>
          </select>
        </div>
        <div>
          <label className="label">Min term (months)</label>
          <input className="input" type="number" min={1} required value={form.minTermMonths} onChange={(e) => update('minTermMonths', Number(e.target.value))} />
        </div>
        <div>
          <label className="label">Max term (months)</label>
          <input className="input" type="number" min={1} required value={form.maxTermMonths} onChange={(e) => update('maxTermMonths', Number(e.target.value))} />
        </div>
        <div>
          <label className="label">Min amount (ZMW)</label>
          <input className="input" type="number" min={1} required value={form.minAmountZMW} onChange={(e) => update('minAmountZMW', Number(e.target.value))} />
        </div>
        <div>
          <label className="label">Max amount (ZMW)</label>
          <input className="input" type="number" min={1} required value={form.maxAmountZMW} onChange={(e) => update('maxAmountZMW', Number(e.target.value))} />
        </div>
        <div>
          <label className="label">Repayment frequency</label>
          <select className="input" value={form.repaymentFrequency} onChange={(e) => update('repaymentFrequency', e.target.value as any)}>
            <option value="DAILY">Daily</option>
            <option value="WEEKLY">Weekly</option>
            <option value="BIWEEKLY">Biweekly</option>
            <option value="MONTHLY">Monthly</option>
            <option value="LUMP_SUM">Lump sum</option>
          </select>
        </div>
        <div>
          <label className="label">Grace period (days)</label>
          <input className="input" type="number" min={0} value={form.gracePeriodDays} onChange={(e) => update('gracePeriodDays', Number(e.target.value))} />
        </div>
        <div className="md:col-span-2">
          <label className="label">Disbursement channels (CSV: CASH, MOBILE_MONEY, BANK_TRANSFER)</label>
          <input className="input" value={form.disbursementChannels} onChange={(e) => update('disbursementChannels', e.target.value)} />
        </div>
        <div>
          <label className="label">Application fee (ZMW)</label>
          <input className="input" type="number" step="0.01" min={0} value={form.applicationFeeZMW} onChange={(e) => update('applicationFeeZMW', Number(e.target.value))} />
        </div>
        <div>
          <label className="label">Processing fee (% of principal)</label>
          <input className="input" type="number" step="0.01" min={0} value={form.processingFeePct} onChange={(e) => update('processingFeePct', Number(e.target.value))} />
        </div>
      </div>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.requiresCollateral} onChange={(e) => update('requiresCollateral', e.target.checked)} />
        Requires collateral
      </label>
      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" checked={form.active} onChange={(e) => update('active', e.target.checked)} />
        Active (available for new applications)
      </label>
      <div className="flex justify-end gap-3">
        <button type="button" className="btn btn-secondary" onClick={() => router.back()}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Saving…' : mode === 'create' ? 'Create product' : 'Save changes'}
        </button>
      </div>
    </form>
  );
}
