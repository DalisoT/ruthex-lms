import { prisma } from '@/lib/db';
import { notFound } from 'next/navigation';
import { requireRole } from '@/lib/rbac';
import ProductForm from '../ProductForm';
import type { ProductInitial } from '../ProductForm';

export const metadata = { title: 'Edit product — Admin — RUTHEX' };

export default async function EditProductPage({ params }: { params: { id: string } }) {
  await requireRole('admin');
  const product = await prisma.loanProduct.findUnique({ where: { id: params.id } });
  if (!product) notFound();
  const initial: ProductInitial = {
    name: product.name,
    description: product.description ?? '',
    interestRateAnnualPct: product.interestRateAnnualPct,
    interestMethod: product.interestMethod as any,
    minTermMonths: product.minTermMonths,
    maxTermMonths: product.maxTermMonths,
    minAmountZMW: product.minAmountZMW,
    maxAmountZMW: product.maxAmountZMW,
    disbursementChannels: product.disbursementChannels,
    repaymentFrequency: product.repaymentFrequency as any,
    gracePeriodDays: product.gracePeriodDays,
    applicationFeeZMW: product.applicationFeeZMW,
    processingFeePct: product.processingFeePct,
    requiresCollateral: product.requiresCollateral,
    active: product.active,
  };
  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">{product.name}</h1>
        <p className="text-sm text-slate-500">Editing product definition. Active loans already on the book are unaffected by changes here.</p>
      </div>
      <ProductForm mode="edit" productId={product.id} initial={initial} />
    </div>
  );
}
