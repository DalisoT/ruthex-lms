import { requireRole } from '@/lib/rbac';
import { redirect } from 'next/navigation';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // The (dashboard) layout already runs the auth gate; this is the additional
  // admin-only subgate. Use requireRole so non-admins get redirected cleanly.
  try {
    await requireRole('admin');
  } catch {
    redirect('/dashboard?forbidden=1');
  }
  return (
    <div className="space-y-4">
      <div className="border-b border-slate-200 pb-2 mb-2 flex items-center gap-4 text-sm">
        <span className="font-bold text-brand-700 uppercase tracking-wide">Admin</span>
        <a href="/admin/users" className="text-slate-600 hover:text-brand-700">Users</a>
        <a href="/admin/products" className="text-slate-600 hover:text-brand-700">Loan products</a>
        <a href="/admin/branches" className="text-slate-600 hover:text-brand-700">Branches</a>
        <a href="/audit-log" className="text-slate-600 hover:text-brand-700">Audit log</a>
      </div>
      {children}
    </div>
  );
}
