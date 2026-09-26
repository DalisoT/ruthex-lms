import { sql, eq, desc, asc, and, or, inArray, ne, gte, lte, gt, lt, isNull, like, ilike } from 'drizzle-orm';
import { db } from '@/lib/db';
import { borrowers, loans, repayments, amlAlerts, auditLogs, users, branches, loanApplications, loanProducts, notifications } from '@/lib/db/schema';

import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/rbac';
import EditUserForm from './EditUserForm';
import ResetPasswordButton from './ResetPasswordButton';

export const metadata = { title: 'Edit user — Admin — RUTHEX' };

export default async function EditUserPage({ params }: { params: { id: string } }) {
  await requireRole('admin');
  const [user, branches] = await Promise.all([
    prisma.user.findUnique({ where: { id: params.id }, include: { branch: true } }),
    prisma.branch.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
  ]);
  if (!user) notFound();

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{user.fullName}</h1>
        <p className="text-sm text-slate-500 font-mono">{user.email}</p>
      </div>

      <EditUserForm
        userId={user.id}
        initial={{
          fullName: user.fullName,
          email: user.email,
          phone: user.phone ?? '',
          role: user.role,
          branchId: user.branchId ?? '',
          fitProperStatus: user.fitProperStatus ?? '',
          active: user.active,
        }}
        branches={branches.map((b) => ({ id: b.id, code: b.code, name: b.name }))}
      />

      <ResetPasswordButton userId={user.id} email={user.email} />
    </div>
  );
}
