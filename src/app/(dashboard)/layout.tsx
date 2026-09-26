import { redirect } from 'next/navigation';
import Link from 'next/link';
import { getCurrentSession } from '@/lib/auth';
import LogoutButton from './LogoutButton';
import { Logo } from '@/components/Logo';

// Every page under (dashboard) reads from the DB and depends on the current
// session. Pre-rendering them at build time fails because DATABASE_URL is a
// runtime secret, not a build-time env var. Force all dashboard pages to
// server-render on demand.
export const dynamic = 'force-dynamic';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await getCurrentSession();
  if (!session) {
    redirect('/login');
  }
  const role = session.role;
  const nav = [
    { href: '/dashboard', label: 'Dashboard', icon: '◉' },
    { href: '/borrowers', label: 'Borrowers', icon: '◍' },
    { href: '/applications', label: 'Applications', icon: '✦', visible: ['ADMIN', 'BRANCH_MANAGER', 'CREDIT_OFFICER', 'LOAN_OFFICER'].includes(role) },
    { href: '/loans', label: 'Loans', icon: '◌' },
    { href: '/repayments', label: 'Repayments', icon: '↻' },
    { href: '/aml', label: 'AML Alerts', icon: '!' },
    { href: '/reports', label: 'BOZ Reports', icon: '☷' },
    { href: '/notifications', label: 'Notifications', icon: '✉' },
    { href: '/audit-log', label: 'Audit log', icon: '☰', visible: ['ADMIN', 'COMPLIANCE_OFFICER', 'AUDITOR'].includes(role) },
    { href: '/admin/users', label: 'Admin', icon: '⚙', visible: role === 'ADMIN' },
    { href: '/settings', label: 'Settings', icon: '⚙' },
  ].filter((n) => n.visible !== false);

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-canvas">
      {/* Sidebar — desktop, deep RUTHEX Green */}
      <aside className="hidden md:flex md:w-64 md:flex-col text-white" style={{ background: 'var(--ruthex-green)' }}>
        <div className="p-6 border-b border-white/10">
          <Link href="/dashboard" className="flex items-center gap-3">
            <Logo size={44} onDark />
            <div>
              <div className="font-bold leading-tight tracking-tight text-base">RUTHEX</div>
              <div className="text-[10px] uppercase tracking-[0.2em] text-emerald-500">Lending Institution</div>
            </div>
          </Link>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {nav.map((item) => (
            <Link key={item.href} href={item.href} className="flex items-center gap-3 px-3 py-2 rounded hover:bg-white/10 text-white/90 hover:text-white text-sm transition">
              <span className="w-4 text-center" style={{ color: 'var(--gold)' }}>{item.icon}</span>
              <span>{item.label}</span>
            </Link>
          ))}
        </nav>
        <div className="p-4 border-t border-white/10 text-xs">
          <div className="mb-2 text-white/70">Logged in as</div>
          <div className="font-medium text-white">{session.email}</div>
          <div className="mt-1 inline-block px-2 py-0.5 rounded text-[10px] uppercase tracking-wide font-bold" style={{ background: 'var(--gold)', color: 'var(--charcoal)' }}>
            {session.role.replace('_', ' ')}
          </div>
          <div className="mt-3">
            <LogoutButton />
          </div>
        </div>
      </aside>

      {/* Mobile header */}
      <header className="md:hidden text-white p-4 flex items-center justify-between" style={{ background: 'var(--ruthex-green)' }}>
        <div className="flex items-center gap-2">
          <Logo size={32} onDark />
          <div className="font-bold">RUTHEX</div>
        </div>
        <LogoutButton />
      </header>

      {/* Mobile bottom nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-rule flex justify-around py-2 z-10">
        {nav.slice(0, 5).map((item) => (
          <Link key={item.href} href={item.href} className="text-xs text-ink text-center px-2">
            <div className="text-lg" style={{ color: 'var(--ruthex-green)' }}>{item.icon}</div>
            {item.label}
          </Link>
        ))}
      </nav>

      <main className="flex-1 p-4 md:p-8 pb-20 md:pb-8 max-w-full overflow-x-hidden">
        {children}
      </main>
    </div>
  );
}
