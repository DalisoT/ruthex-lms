import PublicApplyForm from './PublicApplyForm';
import { eq, asc } from 'drizzle-orm';
import { db } from '@/lib/db';
import { loanProducts } from '@/lib/db/schema';

export const metadata = { title: 'Apply for a loan — RUTHEX' };
export const dynamic = 'force-dynamic';

export default async function PublicApplyPage() {
  const products = await db
    .select()
    .from(loanProducts)
    .where(eq(loanProducts.active, true))
    .orderBy(asc(loanProducts.name));
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
