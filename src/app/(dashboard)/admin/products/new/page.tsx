import { requireRole } from '@/lib/rbac';
import ProductForm from '../ProductForm';

export const metadata = { title: 'New product — Admin — RUTHEX' };

export default async function NewProductPage() {
  await requireRole('admin');
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">Add loan product</h1>
        <p className="text-sm text-slate-500">Define a new lending product. Sets minimum capital, term limits, pricing, and disbursement channels.</p>
      </div>
      <ProductForm mode="create" />
    </div>
  );
}
