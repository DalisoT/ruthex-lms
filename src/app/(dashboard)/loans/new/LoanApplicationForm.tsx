'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';

interface Product {
  id: string; name: string; minAmountZMW: number; maxAmountZMW: number;
  minTermMonths: number; maxTermMonths: number;
  interestRateAnnualPct: number; interestMethod: string;
  repaymentFrequency: string;
}

interface Borrower {
  id: string; borrowerNo: string; firstName: string; lastName: string; phone: string; monthlyIncomeZMW: number | null;
}

export default function LoanApplicationForm({
  products, borrowers, preselectedBorrowerId,
}: { products: Product[]; borrowers: Borrower[]; preselectedBorrowerId: string | null }) {
  const router = useRouter();
  const [borrowerId, setBorrowerId] = useState(preselectedBorrowerId ?? '');
  const [productId, setProductId] = useState(products[0]?.id ?? '');
  const [amount, setAmount] = useState('');
  const [termMonths, setTermMonths] = useState('');
  const [purpose, setPurpose] = useState('BUSINESS');
  const [purposeDetail, setPurposeDetail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scorePreview, setScorePreview] = useState<{ score: number; grade: string; recommendation: string } | null>(null);

  const product = useMemo(() => products.find((p) => p.id === productId), [products, productId]);
  const borrower = useMemo(() => borrowers.find((b) => b.id === borrowerId), [borrowers, borrowerId]);

  async function previewScore() {
    setError(null);
    setScorePreview(null);
    if (!borrower || !amount) {
      setError('Pick a borrower and enter an amount first.');
      return;
    }
    const res = await fetch('/api/credit-score/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        borrowerId: borrower.id,
        requestedAmountZMW: Number(amount),
        termMonths: Number(termMonths || 12),
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setScorePreview(data);
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!borrower || !product) {
      setError('Select borrower and product');
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch('/api/loans/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          borrowerId: borrower.id,
          productId: product.id,
          requestedAmountZMW: Number(amount),
          requestedTermMonths: Number(termMonths || 12),
          purpose,
          purposeDetail,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Failed to submit');
        return;
      }
      const data = await res.json();
      router.push(`/loans/${data.loanId}`);
    } catch {
      setError('Submission failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card-padded space-y-6">
      {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>}

      <section>
        <h2 className="text-sm font-bold uppercase tracking-wide text-brand-700 mb-3">Borrower & product</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Borrower</label>
            <select className="input" value={borrowerId} onChange={(e) => setBorrowerId(e.target.value)} required>
              <option value="">— Select borrower —</option>
              {borrowers.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.borrowerNo} · {b.firstName} {b.lastName} · {b.phone}
                </option>
              ))}
            </select>
            {borrower?.monthlyIncomeZMW != null && (
              <p className="text-xs text-slate-500 mt-1">Declared monthly income: K{borrower.monthlyIncomeZMW.toFixed(2)}</p>
            )}
          </div>
          <div>
            <label className="label">Product</label>
            <select className="input" value={productId} onChange={(e) => setProductId(e.target.value)} required>
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} · {p.interestRateAnnualPct}% · {p.repaymentFrequency}
                </option>
              ))}
            </select>
            {product && (
              <p className="text-xs text-slate-500 mt-1">
                K{product.minAmountZMW.toLocaleString()} – K{product.maxAmountZMW.toLocaleString()} · {product.minTermMonths}–{product.maxTermMonths} months
              </p>
            )}
          </div>
        </div>
      </section>

      <section>
        <h2 className="text-sm font-bold uppercase tracking-wide text-brand-700 mb-3">Loan terms</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="label">Amount requested (ZMW)</label>
            <input className="input" type="number" min={1} required value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div>
            <label className="label">Term (months)</label>
            <input className="input" type="number" min={1} required value={termMonths} onChange={(e) => setTermMonths(e.target.value)} />
          </div>
          <div>
            <label className="label">Purpose</label>
            <select className="input" value={purpose} onChange={(e) => setPurpose(e.target.value)}>
              <option value="BUSINESS">Business working capital</option>
              <option value="SCHOOL_FEES">School fees</option>
              <option value="MEDICAL">Medical</option>
              <option value="HOME_IMPROVEMENT">Home improvement</option>
              <option value="AGRICULTURE">Agriculture</option>
              <option value="OTHER">Other</option>
            </select>
          </div>
          <div>
            <label className="label">Purpose detail</label>
            <input className="input" value={purposeDetail} onChange={(e) => setPurposeDetail(e.target.value)} placeholder="Optional short note" />
          </div>
        </div>
      </section>

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold uppercase tracking-wide text-brand-700">Credit score preview</h2>
          <button type="button" className="btn btn-secondary" onClick={previewScore}>Run score preview</button>
        </div>
        {scorePreview && (
          <div className="border border-slate-200 rounded-lg p-4 bg-slate-50">
            <div className="flex items-center gap-4">
              <div>
                <div className="text-3xl font-bold">{scorePreview.score}</div>
                <div className="text-xs text-slate-500">/1000</div>
              </div>
              <div>
                <div className="text-2xl font-bold">{scorePreview.grade}</div>
                <div className="text-xs text-slate-500">grade</div>
              </div>
              <div className="ml-auto">
                <span className={
                  scorePreview.recommendation === 'APPROVE' ? 'badge-green'
                  : scorePreview.recommendation === 'ENHANCED_DD' ? 'badge-amber'
                  : 'badge-red'
                }>{scorePreview.recommendation.replace('_', ' ')}</span>
              </div>
            </div>
            <p className="text-xs text-slate-500 mt-3">Score uses mobile-money inflow, utility payment regularity, employer stability, prior performance and bureau (if any).</p>
          </div>
        )}
      </section>

      <div className="flex justify-end gap-3">
        <button type="button" className="btn btn-secondary" onClick={() => router.back()}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Submitting…' : 'Submit application'}
        </button>
      </div>
    </form>
  );
}
