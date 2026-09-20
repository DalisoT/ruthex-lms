'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface FormState {
  firstName: string;
  lastName: string;
  middleName: string;
  dateOfBirth: string;
  gender: string;
  nrcNumber: string;
  phone: string;
  phoneAlt: string;
  email: string;
  addressLine1: string;
  city: string;
  province: string;
  district: string;
  employmentStatus: string;
  employerName: string;
  occupation: string;
  monthlyIncomeZMW: string;
  pepFlag: boolean;
  notes: string;
}

const empty: FormState = {
  firstName: '', lastName: '', middleName: '', dateOfBirth: '', gender: '',
  nrcNumber: '', phone: '', phoneAlt: '', email: '',
  addressLine1: '', city: '', province: '', district: '',
  employmentStatus: 'EMPLOYED', employerName: '', occupation: '', monthlyIncomeZMW: '',
  pepFlag: false, notes: '',
};

export default function BorrowerForm() {
  const router = useRouter();
  const [form, setForm] = useState<FormState>(empty);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((s) => ({ ...s, [key]: value }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/borrowers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          monthlyIncomeZMW: form.monthlyIncomeZMW ? Number(form.monthlyIncomeZMW) : null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? 'Failed to create borrower');
        return;
      }
      const data = await res.json();
      router.push(`/borrowers/${data.borrower.id}`);
    } catch {
      setError('Failed to create borrower');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="card-padded space-y-6">
      {error && <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded px-3 py-2">{error}</div>}

      <Section title="Identity">
        <Field label="First name *" name="firstName" required value={form.firstName} onChange={(v) => update('firstName', v)} />
        <Field label="Last name *" name="lastName" required value={form.lastName} onChange={(v) => update('lastName', v)} />
        <Field label="Middle name" name="middleName" value={form.middleName} onChange={(v) => update('middleName', v)} />
        <div>
          <label className="label">Date of birth</label>
          <input className="input" type="date" value={form.dateOfBirth} onChange={(e) => update('dateOfBirth', e.target.value)} />
        </div>
        <div>
          <label className="label">Gender</label>
          <select className="input" value={form.gender} onChange={(e) => update('gender', e.target.value)}>
            <option value="">—</option>
            <option value="M">Male</option>
            <option value="F">Female</option>
            <option value="OTHER">Other</option>
          </select>
        </div>
        <Field label="NRC number" name="nrcNumber" placeholder="123456/78/9" value={form.nrcNumber} onChange={(v) => update('nrcNumber', v)} />
      </Section>

      <Section title="Contact">
        <Field label="Phone (primary) *" name="phone" required placeholder="+260..." value={form.phone} onChange={(v) => update('phone', v)} />
        <Field label="Phone (alternate)" name="phoneAlt" value={form.phoneAlt} onChange={(v) => update('phoneAlt', v)} />
        <Field label="Email" name="email" type="email" value={form.email} onChange={(v) => update('email', v)} />
        <Field label="Address" name="addressLine1" value={form.addressLine1} onChange={(v) => update('addressLine1', v)} full />
        <Field label="City" name="city" value={form.city} onChange={(v) => update('city', v)} />
        <Field label="Province" name="province" value={form.province} onChange={(v) => update('province', v)} />
        <Field label="District" name="district" value={form.district} onChange={(v) => update('district', v)} />
      </Section>

      <Section title="Employment & income">
        <div>
          <label className="label">Employment status</label>
          <select className="input" value={form.employmentStatus} onChange={(e) => update('employmentStatus', e.target.value)}>
            <option value="EMPLOYED">Employed (formal)</option>
            <option value="SELF_EMPLOYED">Self-employed</option>
            <option value="INFORMAL">Informal sector</option>
            <option value="STUDENT">Student</option>
            <option value="RETIRED">Retired</option>
            <option value="UNEMPLOYED">Unemployed</option>
          </select>
        </div>
        <Field label="Employer / business" name="employerName" value={form.employerName} onChange={(v) => update('employerName', v)} />
        <Field label="Occupation" name="occupation" value={form.occupation} onChange={(v) => update('occupation', v)} />
        <Field label="Monthly income (ZMW)" name="monthlyIncomeZMW" type="number" value={form.monthlyIncomeZMW} onChange={(v) => update('monthlyIncomeZMW', v)} />
      </Section>

      <Section title="Compliance flags">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.pepFlag} onChange={(e) => update('pepFlag', e.target.checked)} />
          Politically exposed person (PEP) — requires enhanced due diligence
        </label>
      </Section>

      <Section title="Notes">
        <textarea className="input" rows={3} value={form.notes} onChange={(e) => update('notes', e.target.value)} />
      </Section>

      <div className="flex justify-end gap-3">
        <button type="button" className="btn btn-secondary" onClick={() => router.back()}>Cancel</button>
        <button type="submit" className="btn btn-primary" disabled={submitting}>
          {submitting ? 'Saving…' : 'Create borrower'}
        </button>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="text-sm font-bold uppercase tracking-wide text-brand-700 mb-3">{title}</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
    </section>
  );
}

function Field({
  label, name, type = 'text', required, value, onChange, placeholder, full,
}: {
  label: string; name: string; type?: string; required?: boolean;
  value: string; onChange: (v: string) => void; placeholder?: string; full?: boolean;
}) {
  return (
    <div className={full ? 'md:col-span-2' : ''}>
      <label className="label" htmlFor={name}>{label}</label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="input"
      />
    </div>
  );
}
