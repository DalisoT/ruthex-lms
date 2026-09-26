import PublicApplyForm from './PublicApplyForm';
import { prisma } from '@/lib/db';

export const metadata = { title: 'Apply for a loan — RUTHEX' };
// This page fetches live loan products from the DB — it must be rendered at
// request time, not pre-rendered at build time (the DB is empty during build).
export const dynamic = 'force-dynamic';

export default async function PublicApplyPage() {
  const products = await prisma.loanProduct.findMany({
    where: { active: true },
    orderBy: { name: 'asc' },
  });
  return (
    <PublicApplyForm
      products={products.map((p) => ({
        id: p.id,
        name: p.name,
        minAmountZMW: p.minAmountZMW,
        maxAmountZMW: p.maxAmountZMW,
        minTermMonths: p.minTermMonths,
        maxTermMonths: p.maxTermMonths,
        interestRateAnnualPct: p.interestRateAnnualPct,
        repaymentFrequency: p.repaymentFrequency,
        description: p.description,
      }))}
    />
  );
}
