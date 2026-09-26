/**
 * RUTHEX LMS database seed.
 *
 * Replaces prisma/seed.ts. Uses Drizzle to insert the standard set of demo
 * users, branches, loan products, borrowers, sample loan, and repayment
 * schedule — enough for the dashboard, AML, and BOZ reports to render.
 */
import 'dotenv/config';
import bcrypt from 'bcryptjs';
import { sql, eq } from 'drizzle-orm';
import { db } from '../src/lib/db';
import {
  users, branches, loanProducts, borrowers, loans,
  loanApplications, repaymentSchedule, repayments
} from '../src/lib/db/schema';

async function main() {
  console.log('🌱 Seeding RUTHEX database…');

  // 1. Branch
  const [branch] = await db.insert(branches).values({
    name: 'Lusaka Main',
    code: 'LUS-MAIN',
    province: 'Lusaka',
    city: 'Lusaka',
    address: '123 Independence Ave, Lusaka',
    phone: '+260211234567',
    email: 'lusaka@ruthex.local',
    bozBranchCode: 'LUS-001',
    active: true,
  }).returning();

  // 2. Users
  const passwordHash = await bcrypt.hash('Ruthex@2026', 12);
  const seedUsers = [
    { email: 'admin@ruthex.local', fullName: 'System Administrator', role: 'ADMIN' },
    { email: 'manager@ruthex.local', fullName: 'Mutinta Banda', role: 'BRANCH_MANAGER' },
    { email: 'credit@ruthex.local', fullName: 'Bwalya Mutale', role: 'CREDIT_OFFICER' },
    { email: 'compliance@ruthex.local', fullName: 'Thandiwe Phiri', role: 'COMPLIANCE_OFFICER' },
    { email: 'cashier@ruthex.local', fullName: 'Joseph Mwape', role: 'CASHIER' },
    { email: 'auditor@ruthex.local', fullName: 'Martha Sakala', role: 'AUDITOR' },
    { email: 'lo@ruthex.local', fullName: 'Gift Zulu', role: 'LOAN_OFFICER' },
  ];
  await db.insert(users).values(seedUsers.map((u) => ({
    email: u.email,
    passwordHash,
    fullName: u.fullName,
    phone: '+260971000001',
    role: u.role,
    branchId: branch.id,
    active: true,
    fitProperStatus: 'PASSED',
  })));

  // 3. Loan products
  const seedProducts = [
    { name: 'Payday Loan',         description: 'Salary-backed consumer loan',                    interestRateAnnualPct: 36, interestMethod: 'REDUCING_BALANCE', minTermMonths: 1,  maxTermMonths: 6,  minAmountZMW: 500,     maxAmountZMW: 50_000,    disbursementChannels: 'MOBILE_MONEY,BANK_TRANSFER', repaymentFrequency: 'MONTHLY', requiresCollateral: false, applicationFeeZMW: 50,  processingFeePct: 0.5, gracePeriodDays: 3 },
    { name: 'SME Working Capital', description: 'Working capital for small and medium businesses', interestRateAnnualPct: 32, interestMethod: 'REDUCING_BALANCE', minTermMonths: 3,  maxTermMonths: 36, minAmountZMW: 5_000,    maxAmountZMW: 500_000,   disbursementChannels: 'MOBILE_MONEY,BANK_TRANSFER', repaymentFrequency: 'MONTHLY', requiresCollateral: false, applicationFeeZMW: 200, processingFeePct: 1,   gracePeriodDays: 7 },
    { name: 'Asset Finance',       description: 'Vehicle / equipment financing',                   interestRateAnnualPct: 24, interestMethod: 'REDUCING_BALANCE', minTermMonths: 6,  maxTermMonths: 60, minAmountZMW: 20_000,   maxAmountZMW: 2_000_000, disbursementChannels: 'BANK_TRANSFER',             repaymentFrequency: 'MONTHLY', requiresCollateral: true,  applicationFeeZMW: 500, processingFeePct: 1.5, gracePeriodDays: 14 },
  ];
  const insertedProducts = await db.insert(loanProducts).values(seedProducts).returning();

  // 4. Borrowers
  const seedBorrowers = [
    { borrowerNo: 'BRW-000001', firstName: 'Thandiwe', lastName: 'Mwamba',  phone: '+260971000101', nrcNumber: '123456/78/1', phoneAlt: null, email: 'thandiwe@example.com', addressLine1: 'Plot 45, Kabulonga', city: 'Lusaka', province: 'Lusaka', monthlyIncomeZMW: 6500,  employmentStatus: 'EMPLOYED', employerName: 'Acme Ltd', kycStatus: 'APPROVED', kycRiskRating: 'LOW',    pepFlag: false, kycExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) },
    { borrowerNo: 'BRW-000002', firstName: 'Joseph',   lastName: 'Phiri',   phone: '+260971000102', nrcNumber: '234567/89/1', phoneAlt: null, email: 'joseph@example.com',   addressLine1: 'House 12, Chilenje', city: 'Lusaka', province: 'Lusaka', monthlyIncomeZMW: 4200,  employmentStatus: 'SELF_EMPLOYED', employerName: null, kycStatus: 'APPROVED', kycRiskRating: 'MEDIUM', pepFlag: false, kycExpiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000) },
    { borrowerNo: 'BRW-000003', firstName: 'Miriam',   lastName: 'Banda',   phone: '+260971000103', nrcNumber: '345678/90/1', phoneAlt: null, email: 'miriam@example.com',   addressLine1: 'Plot 8, Roma',      city: 'Lusaka', province: 'Lusaka', monthlyIncomeZMW: 8800,  employmentStatus: 'EMPLOYED', employerName: 'Beta Inc', kycStatus: 'APPROVED', kycRiskRating: 'LOW',    pepFlag: true,  kycExpiresAt: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000) },
  ];
  const insertedBorrowers = await db.insert(borrowers).values(seedBorrowers.map((b) => ({
    ...b,
    sanctionsFlag: false,
    isBeneficialOwner: false,
    status: 'ACTIVE',
    branchId: branch.id,
    notes: null,
    blacklistReason: null,
    kycReviewedAt: new Date(),
    geoLat: null,
    geoLng: null,
    district: null,
  }))).returning();

  // 5. One sample loan on Thandiwe
  const [loan] = await db.insert(loans).values({
    loanNo: 'LN-0000001',
    borrowerId: insertedBorrowers[0].id,
    productId: insertedProducts[0].id,
    branchId: branch.id,
    principalZMW: 10_000,
    interestRateAnnualPct: 36,
    interestMethod: 'REDUCING_BALANCE',
    termMonths: 3,
    repaymentFrequency: 'MONTHLY',
    installmentZMW: 3500,
    totalRepayableZMW: 10_500,
    firstPaymentDue: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
    maturityDate: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
    status: 'ACTIVE',
    disbursementChannel: 'MOBILE_MONEY',
    disbursementRef: 'MTN-MOCK-001',
    disbursedAt: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000),
    principalOutstandingZMW: 3000,
    interestOutstandingZMW: 200,
    feesOutstandingZMW: 0,
    totalOutstandingZMW: 3200,
  }).returning();

  // 6. Repayment schedule
  const scheduleStart = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000);
  const installments = [];
  for (let i = 0; i < 3; i++) {
    const due = new Date(scheduleStart);
    due.setDate(due.getDate() + i * 30);
    installments.push({
      loanId: loan.id,
      installmentNo: i + 1,
      dueDate: due,
      principalDue: 3300,
      interestDue: 200,
      feesDue: 0,
      totalDue: 3500,
      totalPaid: i < 1 ? 3500 : 0,
      paidAt: i < 1 ? due : null,
      status: i < 1 ? 'PAID' : (i === 1 ? 'OVERDUE' : 'PENDING'),
    });
  }
  await db.insert(repaymentSchedule).values(installments);

  // 7. One repayment receipt
  await db.insert(repayments).values({
    receiptNo: 'RCT-0000001',
    loanId: loan.id,
    installmentId: installments[0].installmentNo ? (await db.select({ id: repaymentSchedule.id }).from(repaymentSchedule).where(eq(repaymentSchedule.loanId, loan.id)).limit(1))[0]?.id ?? null : null,
    recordedById: (await db.select({ id: users.id }).from(users).where(eq(users.email, 'cashier@ruthex.local')).limit(1))[0]?.id!,
    principalPaidZMW: 3300,
    interestPaidZMW: 200,
    feesPaidZMW: 0,
    totalPaidZMW: 3500,
    paymentMethod: 'MOBILE_MONEY',
    paymentChannel: 'MTN',
    externalRef: 'MTN-MOCK-001',
    receivedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
    postedAt: new Date(Date.now() - 60 * 24 * 60 * 60 * 1000),
    status: 'POSTED',
  });

  console.log('✅ Seed complete.');
  console.log('Login: admin@ruthex.local / Ruthex@2026');
  console.log('       manager@ruthex.local / Ruthex@2026');
  console.log('       credit@ruthex.local / Ruthex@2026');
  console.log('       compliance@ruthex.local / Ruthex@2026');
  console.log('       cashier@ruthex.local / Ruthex@2026');
  console.log('       auditor@ruthex.local / Ruthex@2026');
  console.log('       lo@ruthex.local / Ruthex@2026');
  await (db as any).$client?.end?.();
  process.exit(0);
}

main().catch((e) => { console.error(e); process.exit(1); });
