/**
 * RUTHEX Lending Institution — seed script.
 *
 * Creates:
 *   - Default Lusaka branch
 *   - Admin, branch manager, credit officer, compliance officer, cashier, auditor users
 *   - 3 starter loan products (consumer, SME, agriculture)
 *   - 3 demo borrowers with KYC APPROVED
 *   - 1 sample active loan with 6-month schedule and a partial repayment
 *
 * Usage: npm run db:seed (after `npm run db:push`).
 */
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding RUTHEX database…');

  // 1. Branch
  const branch = await prisma.branch.upsert({
    where: { code: 'LUSAKA-01' },
    update: {},
    create: {
      code: 'LUSAKA-01',
      name: 'RUTHEX Lusaka Main',
      province: 'Lusaka',
      city: 'Lusaka',
      address: 'Plot 1234, Cairo Road, Lusaka',
      phone: '+260211234567',
      email: 'lusaka@ruthex.local',
      bozBranchCode: 'LUS-MAIN',
    },
  });

  // 2. Users
  const passwordHash = await bcrypt.hash('Ruthex@2026', 12);
  const users = [
    { email: 'admin@ruthex.local',       name: 'System Administrator',    role: 'ADMIN',              phone: '+260971000001' },
    { email: 'manager@ruthex.local',     name: 'Mutinta Banda',           role: 'BRANCH_MANAGER',     phone: '+260971000002' },
    { email: 'credit@ruthex.local',      name: 'Bwalya Mutale',           role: 'CREDIT_OFFICER',     phone: '+260971000003' },
    { email: 'compliance@ruthex.local',  name: 'Thandiwe Phiri',          role: 'COMPLIANCE_OFFICER', phone: '+260971000004' },
    { email: 'cashier@ruthex.local',     name: 'Joseph Mwape',            role: 'CASHIER',            phone: '+260971000005' },
    { email: 'auditor@ruthex.local',     name: 'Martha Sakala',           role: 'AUDITOR',            phone: '+260971000006' },
    { email: 'lo@ruthex.local',          name: 'Gift Zulu',               role: 'LOAN_OFFICER',       phone: '+260971000007' },
  ];
  for (const u of users) {
    await prisma.user.upsert({
      where: { email: u.email },
      update: {},
      create: {
        email: u.email,
        passwordHash,
        fullName: u.name,
        phone: u.phone,
        role: u.role,
        branchId: branch.id,
        fitProperStatus: u.role === 'ADMIN' || u.role === 'COMPLIANCE_OFFICER' || u.role === 'BRANCH_MANAGER' || u.role === 'CREDIT_OFFICER' ? 'PASSED' : null,
      },
    });
  }

  const creditOfficer = await prisma.user.findUnique({ where: { email: 'credit@ruthex.local' } });
  const cashier = await prisma.user.findUnique({ where: { email: 'cashier@ruthex.local' } });
  const complianceOfficer = await prisma.user.findUnique({ where: { email: 'compliance@ruthex.local' } });

  // 3. Loan products
  const products = [
    { name: 'Payday Loan', description: 'Salary-backed consumer loan', interestRateAnnualPct: 36, interestMethod: 'REDUCING_BALANCE', minTermMonths: 1, maxTermMonths: 6, minAmountZMW: 500, maxAmountZMW: 50_000, repaymentFrequency: 'MONTHLY', requiresCollateral: false },
    { name: 'SME Working Capital', description: 'Working capital for small and medium businesses', interestRateAnnualPct: 32, interestMethod: 'REDUCING_BALANCE', minTermMonths: 3, maxTermMonths: 36, minAmountZMW: 5_000, maxAmountZMW: 500_000, repaymentFrequency: 'MONTHLY', requiresCollateral: false },
    { name: 'Asset Finance', description: 'Vehicle / equipment financing', interestRateAnnualPct: 24, interestMethod: 'REDUCING_BALANCE', minTermMonths: 6, maxTermMonths: 60, minAmountZMW: 20_000, maxAmountZMW: 2_000_000, repaymentFrequency: 'MONTHLY', requiresCollateral: true },
  ];
  for (const p of products) {
    await prisma.loanProduct.upsert({
      where: { name: p.name },
      update: {},
      create: p,
    });
  }

  // 4. Demo borrowers
  const borrowers = [
    { borrowerNo: 'RB-0000001', firstName: 'Mwila',  lastName: 'Chomba',  phone: '+260971111111', nrc: '123456/78/9', income: 8_500, employer: 'Zambeef', occupation: 'Operations Officer' },
    { borrowerNo: 'RB-0000002', firstName: 'Natasha', lastName: 'Mbewe',  phone: '+260972222222', nrc: '234567/89/0', income: 12_000, employer: 'Stanbic Bank', occupation: 'Branch Manager' },
    { borrowerNo: 'RB-0000003', firstName: 'Bright', lastName: 'Soko',  phone: '+260973333333', nrc: '345678/90/1', income: 6_500, employer: 'Own business', occupation: 'Trader' },
  ];
  for (const b of borrowers) {
    await prisma.borrower.upsert({
      where: { borrowerNo: b.borrowerNo },
      update: {},
      create: {
        borrowerNo: b.borrowerNo,
        firstName: b.firstName,
        lastName: b.lastName,
        phone: b.phone,
        nrcNumber: b.nrc,
        employmentStatus: 'EMPLOYED',
        employerName: b.employer,
        occupation: b.occupation,
        monthlyIncomeZMW: b.income,
        kycStatus: 'APPROVED',
        kycReviewedAt: new Date(),
        kycReviewerId: complianceOfficer?.id ?? null,
        kycRiskRating: 'LOW',
        kycExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
        status: 'ACTIVE',
        branchId: branch.id,
        assignedOfficerId: creditOfficer?.id ?? null,
        province: 'Lusaka',
        city: 'Lusaka',
        addressLine1: 'Plot 123, Off Cairo Road',
      },
    });
  }

  // 5. Sample active loan for Mwila Chomba
  const mwila = await prisma.borrower.findUnique({ where: { borrowerNo: 'RB-0000001' } });
  const smeProduct = await prisma.loanProduct.findUnique({ where: { name: 'SME Working Capital' } });
  if (mwila && smeProduct) {
    const existing = await prisma.loan.findFirst({ where: { borrowerId: mwila.id, productId: smeProduct.id } });
    if (!existing) {
      const loan = await prisma.loan.create({
        data: {
          loanNo: 'LN-0000001',
          borrowerId: mwila.id,
          productId: smeProduct.id,
          branchId: branch.id,
          principalZMW: 25_000,
          interestRateAnnualPct: smeProduct.interestRateAnnualPct,
          interestMethod: smeProduct.interestMethod,
          termMonths: 6,
          repaymentFrequency: 'MONTHLY',
          installmentZMW: 4_350,
          totalRepayableZMW: 26_100,
          disbursedAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
          disbursementChannel: 'MOBILE_MONEY',
          firstPaymentDue: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
          maturityDate: new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
          status: 'ACTIVE',
          principalOutstandingZMW: 16_500,
          interestOutstandingZMW: 280,
          feesOutstandingZMW: 0,
          totalOutstandingZMW: 16_780,
        },
      });
      // Schedule
      const today = new Date();
      for (let i = 0; i < 6; i++) {
        const due = new Date(today);
        due.setMonth(due.getMonth() - 3 + i);
        await prisma.repaymentSchedule.create({
          data: {
            loanId: loan.id,
            installmentNo: i + 1,
            dueDate: due,
            principalDue: 4170,
            interestDue: 180,
            feesDue: 0,
            totalDue: 4350,
            totalPaid: i < 3 ? 4350 : 0,
            paidAt: i < 3 ? new Date(due) : null,
            status: i < 3 ? 'PAID' : (i === 3 ? 'OVERDUE' : 'PENDING'),
          },
        });
      }
      // One partial repayment recorded
      await prisma.repayment.create({
        data: {
          receiptNo: 'RCT-0000001',
          loanId: loan.id,
          recordedById: cashier?.id ?? creditOfficer?.id ?? null,
          principalPaidZMW: 4170,
          interestPaidZMW: 180,
          feesPaidZMW: 0,
          totalPaidZMW: 4350,
          paymentMethod: 'MOBILE_MONEY',
          paymentChannel: 'MTN',
          externalRef: 'MTN-MOCK-001',
          receivedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
          postedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
        },
      });
    }
  }

  // 6. Audit log seed entry
  await prisma.auditLog.create({
    data: {
      action: 'SYSTEM_SEEDED',
      entity: 'SYSTEM',
      prevHash: null,
      hash: 'seeded-' + Date.now(),
      meta: JSON.stringify({ seededAt: new Date().toISOString() }),
    },
  });

  console.log('✅ Seed complete.');
  console.log('Login: admin@ruthex.local / Ruthex@2026');
  console.log('       manager@ruthex.local / Ruthex@2026');
  console.log('       credit@ruthex.local / Ruthex@2026');
  console.log('       compliance@ruthex.local / Ruthex@2026');
  console.log('       cashier@ruthex.local / Ruthex@2026');
  console.log('       auditor@ruthex.local / Ruthex@2026');
  console.log('       lo@ruthex.local / Ruthex@2026');
}

main()
  .then(async () => { await prisma.$disconnect(); })
  .catch(async (e) => { console.error(e); await prisma.$disconnect(); process.exit(1); });
