import { prisma } from '@/lib/db';
import { requireRole } from '@/lib/rbac';
import NewUserForm from './NewUserForm';

export const metadata = { title: 'New user — Admin — RUTHEX' };

export default async function NewUserPage() {
  await requireRole('admin');
  const branches = await prisma.branch.findMany({ where: { active: true }, orderBy: { name: 'asc' } });
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Add user</h1>
        <p className="text-sm text-slate-500">Create a new RUTHEX operator account. They will receive the default password and should change it on first login.</p>
      </div>
      <NewUserForm branches={branches.map((b) => ({ id: b.id, code: b.code, name: b.name }))} />
    </div>
  );
}
