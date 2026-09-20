import { prisma } from '@/lib/db';
import Link from 'next/link';
import { requireRole } from '@/lib/rbac';
import { formatZMW, formatPercent } from '@/lib/utils';

export const metadata = { title: 'Loan products — Admin — RUTHEX' };

export default async function ProductsPage() {
  await requireRole('admin');
  const products = await prisma.loanProduct.findMany({ orderBy: { name: 'asc' } });
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold">Loan products</h1>
          <p className="text-sm text-slate-500">Define the lending products RUTHEX offers. Toggling off hides the product from new applications without retiring existing loans.</p>
        </div>
        <Link href="/admin/products/new" className="btn btn-primary">+ Add product</Link>
      </div>
      <div className="card overflow-x-auto">
        <table className="table-base responsive-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Interest</th>
              <th>Method</th>
              <th>Frequency</th>
              <th>Amount range</th>
              <th>Term</th>
              <th>Collateral</th>
              <th>Status</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {products.length === 0 ? (
              <tr><td colSpan={9} className="text-center py-8 text-slate-500">No products defined yet.</td></tr>
            ) : products.map((p) => (
              <tr key={p.id}>
                <td>
                  <div className="font-medium">{p.name}</div>
                  <div className="text-xs text-slate-500">{p.description}</div>
                </td>
                <td>{formatPercent(p.interestRateAnnualPct)}</td>
                <td className="text-xs">{p.interestMethod.replace(/_/g, ' ').toLowerCase()}</td>
                <td className="text-xs">{p.repaymentFrequency}</td>
                <td className="text-xs">{formatZMW(p.minAmountZMW)} – {formatZMW(p.maxAmountZMW)}</td>
                <td className="text-xs">{p.minTermMonths}–{p.maxTermMonths}m</td>
                <td className="text-xs">{p.requiresCollateral ? 'Yes' : 'No'}</td>
                <td>
                  {p.active ? <span className="badge-green">Active</span> : <span className="badge-gray">Off</span>}
                </td>
                <td><Link href={`/admin/products/${p.id}`} className="text-brand-700 hover:underline">Edit →</Link></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
