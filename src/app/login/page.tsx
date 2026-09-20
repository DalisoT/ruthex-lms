import LoginForm from './LoginForm';
import { getCurrentSession } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { Logo } from '@/components/Logo';

export const metadata = { title: 'Sign in — RUTHEX' };

export default async function LoginPage() {
  const session = await getCurrentSession();
  if (session) redirect('/dashboard');

  return (
    <div className="min-h-screen flex">
      {/* Left: brand panel — RUTHEX green with gold logo */}
      <div
        className="hidden md:flex md:w-1/2 lg:w-2/5 text-white flex-col justify-between p-12"
        style={{ background: 'var(--ruthex-green)' }}
      >
        <div>
          <div className="flex items-center gap-3">
            <Logo size={48} onDark />
            <div>
              <div className="font-bold text-xl tracking-tight">RUTHEX</div>
              <div className="text-[11px] uppercase tracking-[0.25em] text-emerald-500">Lending Institution</div>
            </div>
          </div>
        </div>
        <div className="space-y-5 max-w-md">
          <h1 className="text-4xl lg:text-5xl font-black leading-tight tracking-tight">
            Microfinance,
            <br />
            <span style={{ color: 'var(--gold)' }}>done right.</span>
          </h1>
          <p className="text-white/85 text-base leading-relaxed">
            A complete loan management system built for Zambian operators under the Bank of Zambia&apos;s
            microfinance framework — every KYC, AML, and BOZ obligation wired in.
          </p>
          <div className="flex flex-wrap gap-2 pt-2">
            <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded" style={{ background: 'rgba(212,175,55,0.20)', color: 'var(--gold)' }}>Bank of Zambia</span>
            <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded border border-white/30">BFSA 2017 · 2026</span>
            <span className="text-[10px] uppercase tracking-wider px-2 py-1 rounded border border-white/30">FIC AML / CFT</span>
          </div>
        </div>
        <div className="text-xs text-white/60">
          © {new Date().getFullYear()} RUTHEX Lending Institution · Regulated microfinance
        </div>
      </div>

      {/* Right: sign-in form */}
      <div className="flex-1 flex items-center justify-center p-6" style={{ background: '#F8FAF9' }}>
        <div className="w-full max-w-md">
          {/* Mobile-only brand mark */}
          <div className="md:hidden flex items-center justify-center gap-3 mb-6">
            <Logo size={48} />
            <div>
              <div className="font-bold text-xl">RUTHEX</div>
              <div className="text-[11px] uppercase tracking-[0.25em] text-emerald-600">Lending Institution</div>
            </div>
          </div>
          <div className="card-padded shadow-lg">
            <h2 className="text-2xl font-black text-ink">Sign in</h2>
            <p className="text-sm text-ink/70 mt-1">Use your RUTHEX operator credentials.</p>
            <div className="mt-4">
              <LoginForm />
            </div>
          </div>
          <p className="text-center text-xs text-ink/60 mt-6">
            Need an account? Contact your branch administrator.
          </p>
        </div>
      </div>
    </div>
  );
}
