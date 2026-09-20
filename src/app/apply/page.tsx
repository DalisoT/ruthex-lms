import PublicApplyForm from './PublicApplyForm';
import { prisma } from '@/lib/db';

export const metadata = { title: 'Apply for a loan — RUTHEX' };

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
