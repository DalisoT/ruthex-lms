import BorrowerForm from './BorrowerForm';
import { getCurrentSession } from '@/lib/auth';
import { redirect } from 'next/navigation';

export const metadata = { title: 'New borrower — RUTHEX' };

export default async function NewBorrowerPage() {
  const session = await getCurrentSession();
  if (!session) redirect('/login');

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Onboard new borrower</h1>
        <p className="text-sm text-slate-500">Capture KYC details. The borrower will be in PENDING KYC status until reviewed.</p>
      </div>
      <BorrowerForm />
    </div>
  );
}
