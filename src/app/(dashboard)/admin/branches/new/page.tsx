import { requireRole } from '@/lib/rbac';
import BranchForm from '../BranchForm';

export const metadata = { title: 'New branch — Admin — RUTHEX' };

export default async function NewBranchPage() {
  await requireRole('admin');
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Add branch</h1>
        <p className="text-sm text-slate-500">A branch code appears on every receipt and BOZ report. Pick a stable short code.</p>
      </div>
      <BranchForm mode="create" />
    </div>
  );
}
