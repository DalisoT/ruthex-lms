import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/rbac';
import BranchForm from '../BranchForm';
import type { BranchInitial } from '../BranchForm';

export const metadata = { title: 'Edit branch — Admin — RUTHEX' };

export default async function EditBranchPage({ params }: { params: { id: string } }) {
  await requireRole('admin');
  const branch = await prisma.branch.findUnique({ where: { id: params.id } });
  if (!branch) notFound();
  const initial: BranchInitial = {
    name: branch.name, code: branch.code,
    province: branch.province ?? '', city: branch.city ?? '',
    address: branch.address ?? '', phone: branch.phone ?? '',
    email: branch.email ?? '', bozBranchCode: branch.bozBranchCode ?? '',
    active: branch.active,
  };
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{branch.name}</h1>
        <p className="text-sm text-slate-500 font-mono">{branch.code}</p>
      </div>
      <BranchForm mode="edit" branchId={branch.id} initial={initial} />
    </div>
  );
}
