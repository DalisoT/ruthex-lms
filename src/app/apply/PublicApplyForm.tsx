'use client';

import { useState } from 'react';
import { Logo } from '@/components/Logo';

interface Product {
  id: string; name: string; minAmountZMW: number; maxAmountZMW: number;
  minTermMonths: number; maxTermMonths: number;
  interestRateAnnualPct: number; repaymentFrequency: string;
  description: string | null;
}

export default function PublicApplyForm({ products }: { products: Product[] | any[] }) {
  const [step, setStep] = useState<'form' | 'kyc' | 'submitted'>('form');
  const [borrowerId, setBorrowerId] = useState<string | null>(null);
  const [submissionMessage, setSubmissionMessage] = useState<string>('');

  if (step === 'submitted') {
    return (
      <Centered>
        <div className="card-padded shadow-lg max-w-md text-center">
          <div className="text-5xl mb-3">✓</div>
          <h1 className="text-2xl font-bold text-brand-900">Application received</h1>
          <p className="text-slate-700 mt-2">{submissionMessage}</p>
          <p className="text-sm text-slate-500 mt-4">Reference: <span className="font-mono">{borrowerId}</span></p>
        </div>
      </Centered>
    );
  }

  if (step === 'kyc' && borrowerId) {
    return <KycStep borrowerId={borrowerId} onComplete={(msg) => { setSubmissionMessage(msg); setStep('submitted'); }} />;
  }

  return <FormStep products={products} onSubmit={(b) => { setBorrowerId(b); setStep('kyc'); }} />;
}

function Centered({ children }: { children: React.ReactNode }) {
  return <div className="min-h-screen bg-gradient-to-br from-brand-50 to-brand-100 p-4 flex items-center justify-center">{children}</div>;
}

function FormStep({ products, onSubmit }: { products: Product[]; onSubmit: (borrowerId: string) => void }) {
  const [form, setForm] = useState({
    firstName: '', lastName: '', middleName: '',
    nrcNumber: '', phone: '', email: '',
    addressLine1: '', city: '', province: '',
    employmentStatus: 'EMPLOYED', employerName: '', occupation: '', monthlyIncomeZMW: '',
    productId: products[0]?.id ?? '',
    requestedAmountZMW: '',
    requestedTermMonths: '',
    purpose: 'BUSINESS', purposeDetail: '',
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof typeof form>(k: K, v: typeof form[K]) { setForm((s) => ({ ...s, [k]: v })); }

  async function onApply(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setSubmitting(true);
    try {
      const res = await fetch('/api/public/apply', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, monthlyIncomeZMW: form.monthlyIncomeZMW ? Number(form.monthlyIncomeZMW) : null, requestedAmountZMW: Number(form.requestedAmountZMW), requestedTermMonths: Number(form.requestedTermMonths) }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Failed to submit');
        return;
      }
      const data = await res.json();
      onSubmit(data.borrowerId);
    } catch {
      setError('Submission failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 to-brand-100 p-4 py-12">
      <div className="max-w-2xl mx-auto">
        <div className="text-center mb-8">
          <div className="inline-block mb-4 shadow-soft">
            <Logo size={72} />
          </div>
          <h1 className="text-3xl font-bold text-brand-700">RUTHEX Lending Institution</h1>
          <p className="text-emerald-600">Apply for a loan in minutes.</p>
        </div>
        <form onSubmit={onApply} className="card-padded shadow-lg space-y-6">
          {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>}

          <Section title="Your details">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <Input label="First name *" required value={form.firstName} onChange={(v) => update('firstName', v)} />
              <Input label="Last name *" required value={form.lastName} onChange={(v) => update('lastName', v)} />
              <Input label="NRC number" value={form.nrcNumber} onChange={(v) => update('nrcNumber', v)} placeholder="123456/78/9" />
              <Input label="Phone *" required value={form.phone} onChange={(v) => update('phone', v)} placeholder="+260..." />
              <Input label="Email" type="email" value={form.email} onChange={(v) => update('email', v)} />
              <Input label="City" value={form.city} onChange={(v) => update('city', v)} />
            </div>
          </Section>

          <Section title="Loan you want">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="label">Product</label>
                <select className="input" value={form.productId} onChange={(e) => update('productId', e.target.value)} required>
                  {products.map((p: any) => (
                    <option key={p.id} value={p.id}>
                      {p.name} · {p.interestRateAnnualPct}% · {p.repaymentFrequency}
                    </option>
                  ))}
                </select>
              </div>
              <Input label="Amount (ZMW) *" required type="number" value={form.requestedAmountZMW} onChange={(v) => update('requestedAmountZMW', v)} />
              <Input label="Term (months) *" required type="number" value={form.requestedTermMonths} onChange={(v) => update('requestedTermMonths', v)} />
              <div>
                <label className="label">Purpose</label>
                <select className="input" value={form.purpose} onChange={(e) => update('purpose', e.target.value)}>
                  <option value="BUSINESS">Business</option>
                  <option value="SCHOOL_FEES">School fees</option>
                  <option value="MEDICAL">Medical</option>
                  <option value="HOME_IMPROVEMENT">Home improvement</option>
                  <option value="AGRICULTURE">Agriculture</option>
                  <option value="OTHER">Other</option>
                </select>
              </div>
            </div>
          </Section>

          <Section title="Quick income">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="label">Employment</label>
                <select className="input" value={form.employmentStatus} onChange={(e) => update('employmentStatus', e.target.value)}>
                  <option value="EMPLOYED">Employed</option>
                  <option value="SELF_EMPLOYED">Self-employed</option>
                  <option value="INFORMAL">Informal</option>
                  <option value="STUDENT">Student</option>
                  <option value="RETIRED">Retired</option>
                  <option value="UNEMPLOYED">Unemployed</option>
                </select>
              </div>
              <Input label="Monthly income (ZMW)" type="number" value={form.monthlyIncomeZMW} onChange={(v) => update('monthlyIncomeZMW', v)} />
            </div>
            <p className="text-xs text-slate-500 mt-3">We will verify your information and call you within one business day. No application fee.</p>
          </Section>

          <button type="submit" className="btn btn-primary w-full" disabled={submitting}>
            {submitting ? 'Submitting…' : 'Continue →'}
          </button>
        </form>
        <p className="text-center text-xs text-slate-500 mt-6">Regulated by the Bank of Zambia · Banking and Financial Services Act 2017</p>
      </div>
    </div>
  );
}

function KycStep({ borrowerId, onComplete }: { borrowerId: string; onComplete: (msg: string) => void }) {
  const [idFileName, setIdFileName] = useState('');
  const [selfieName, setSelfieName] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onKyc(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setSubmitting(true);
    try {
      const res = await fetch('/api/public/kyc', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ borrowerId, idFileName, selfieName }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Failed');
        return;
      }
      const data = await res.json();
      onComplete(`We&apos;ve queued your application for review. ${data.pendingLoans ? ` ${data.pendingLoans} loan request(s) awaiting a loan officer.` : ''}`);
    } catch {
      setError('Submission failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-brand-50 to-brand-100 p-4 py-12">
      <div className="max-w-md mx-auto">
        <div className="card-padded shadow-lg space-y-4">
          <div>
            <h1 className="text-2xl font-bold text-brand-900">Verify your identity</h1>
            <p className="text-sm text-slate-600 mt-1">Upload a clear photo of your NRC (front and back) and a selfie. An officer will review within one business day.</p>
          </div>
          {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>}
          <form onSubmit={onKyc} className="space-y-4">
            <div>
              <label className="label">NRC photo (file name)</label>
              <input className="input" value={idFileName} onChange={(e) => setIdFileName(e.target.value)} placeholder="nrc_front.jpg" />
            </div>
            <div>
              <label className="label">Selfie (file name)</label>
              <input className="input" value={selfieName} onChange={(e) => setSelfieName(e.target.value)} placeholder="selfie.jpg" />
            </div>
            <p className="text-xs text-slate-500">In the production app this is a camera upload. For now we record the file names against your KYC.</p>
            <button type="submit" className="btn btn-primary w-full" disabled={submitting}>
              {submitting ? 'Submitting…' : 'Submit for review'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-sm font-bold uppercase tracking-wide text-brand-700 mb-3">{title}</h2>
      {children}
    </section>
  );
}

function Input({ label, type = 'text', value, onChange, required, placeholder }: { label: string; type?: string; value: string; onChange: (v: string) => void; required?: boolean; placeholder?: string }) {
  return (
    <div>
      <label className="label">{label}</label>
      <input type={type} className="input" value={value} onChange={(e) => onChange(e.target.value)} required={required} placeholder={placeholder} />
    </div>
  );
}
