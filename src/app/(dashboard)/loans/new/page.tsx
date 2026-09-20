import { prisma } from '@/lib/db';
import { redirect } from 'next/navigation';
import { getCurrentSession } from '@/lib/auth';
import LoanApplicationForm from './LoanApplicationForm';

export const metadata = { title: 'New loan application — RUTHEX' };

export default async function NewLoanPage({ searchParams }: { searchParams: { borrowerId?: string } }) {
  const session = await getCurrentSession();
  if (!session) redirect('/login');

  const [products, borrowers] = await Promise.all([
    prisma.loanProduct.findMany({ where: { active: true }, orderBy: { name: 'asc' } }),
    prisma.borrower.findMany({
      where: { status: 'ACTIVE', kycStatus: 'APPROVED' },
      orderBy: { firstName: 'asc' },
      select: { id: true, borrowerNo: true, firstName: true, lastName: true, phone: true, monthlyIncomeZMW: true },
    }),
  ]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-bold">New loan application</h1>
        <p className="text-sm text-slate-500">Capture the request. The system scores it and routes it through approval.</p>
      </div>
      <LoanApplicationForm
        products={products.map((p) => ({
          id: p.id, name: p.name, minAmountZMW: p.minAmountZMW, maxAmountZMW: p.maxAmountZMW,
          minTermMonths: p.minTermMonths, maxTermMonths: p.maxTermMonths,
          interestRateAnnualPct: p.interestRateAnnualPct, interestMethod: p.interestMethod,
          repaymentFrequency: p.repaymentFrequency,
        }))}
        borrowers={borrowers}
        preselectedBorrowerId={searchParams.borrowerId ?? null}
      />
    </div>
  );
}
