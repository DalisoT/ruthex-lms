/**
 * RUTHEX Lending Institution — Drizzle ORM schema.
 *
 * Replaces prisma/schema.prisma. Engineered for the Bank of Zambia NDT MFI
 * requirements documented in docs/regulatory-mapping.md. Postgres dialect
 * (Neon in production). Drizzle chosen over Prisma because it generates
 * zero JS at runtime — no eval(), no V8 workarounds — so it runs natively
 * on Cloudflare Workers V8 isolates.
 *
 * Notes on choices vs the original Prisma schema:
 *   - Postgres-native enums could be used (vs string fields in Prisma).
 *     Keeping as string fields so the schema is portable and seed data is
 *     human-readable; application-level guards live in src/lib/types.ts.
 *   - Money is stored as `double precision` (the Postgres equivalent of
 *     Float). Same caveat as the Prisma schema — fine at MFI scale.
 *   - cuid IDs preserved by generating via Postgres gen_random_uuid() and
 *     a Postgres-side prefix... actually, since we removed cuid (Drizzle
 *     uses uuid), the column is just `id uuid PRIMARY KEY DEFAULT gen_random_uuid()`.
 */

import {
  pgTable,
  uuid,
  text,
  timestamp,
  boolean,
  integer,
  doublePrecision,
  uniqueIndex,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';

// -----------------------------------------------------------------------------
// IDENTITY, ACCESS, AUDIT
// -----------------------------------------------------------------------------

export const users = pgTable(
  'User',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    email: text('email').notNull().unique(),
    passwordHash: text('passwordHash').notNull(),
    fullName: text('fullName').notNull(),
    phone: text('phone'),
    role: text('role').notNull(), // ADMIN | BRANCH_MANAGER | CREDIT_OFFICER | CASHIER | COMPLIANCE_OFFICER | AUDITOR | LOAN_OFFICER
    branchId: uuid('branchId'),
    active: boolean('active').notNull().default(true),
    failedLoginCount: integer('failedLoginCount').notNull().default(0),
    lastLoginAt: timestamp('lastLoginAt', { withTimezone: true }),
    fitProperStatus: text('fitProperStatus'), // PASSED | PENDING | FAILED
    createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    roleIdx: index('User_role_idx').on(t.role),
    branchIdx: index('User_branchId_idx').on(t.branchId),
  }),
);

export const branches = pgTable('Branch', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: text('name').notNull(),
  code: text('code').notNull().unique(),
  province: text('province'),
  city: text('city'),
  address: text('address'),
  phone: text('phone'),
  email: text('email'),
  bozBranchCode: text('bozBranchCode'),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
});

export const auditLogs = pgTable(
  'AuditLog',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    occurredAt: timestamp('occurredAt', { withTimezone: true }).notNull().defaultNow(),
    userId: uuid('userId'),
    action: text('action').notNull(),
    entity: text('entity').notNull(),
    entityId: text('entityId'),
    ipAddress: text('ipAddress'),
    userAgent: text('userAgent'),
    prevHash: text('prevHash'),
    hash: text('hash'),
    meta: text('meta'),
  },
  (t) => ({
    entityIdx: index('AuditLog_entity_entityId_idx').on(t.entity, t.entityId),
    occurredAtIdx: index('AuditLog_occurredAt_idx').on(t.occurredAt),
    userIdx: index('AuditLog_userId_idx').on(t.userId),
  }),
);

// -----------------------------------------------------------------------------
// BORROWER, KYC, DOCUMENTS
// -----------------------------------------------------------------------------

export const borrowers = pgTable(
  'Borrower',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    borrowerNo: text('borrowerNo').notNull().unique(),
    firstName: text('firstName').notNull(),
    lastName: text('lastName').notNull(),
    middleName: text('middleName'),
    dateOfBirth: timestamp('dateOfBirth', { withTimezone: true }),
    gender: text('gender'),
    maritalStatus: text('maritalStatus'),
    nationality: text('nationality').notNull().default('Zambian'),
    nrcNumber: text('nrcNumber'),
    passportNumber: text('passportNumber'),
    phone: text('phone').notNull(),
    phoneAlt: text('phoneAlt'),
    email: text('email'),
    addressLine1: text('addressLine1'),
    addressLine2: text('addressLine2'),
    city: text('city'),
    province: text('province'),
    district: text('district'),
    geoLat: doublePrecision('geoLat'),
    geoLng: doublePrecision('geoLng'),
    employmentStatus: text('employmentStatus'),
    employerName: text('employerName'),
    occupation: text('occupation'),
    monthlyIncomeZMW: doublePrecision('monthlyIncomeZMW'),
    kycStatus: text('kycStatus').notNull().default('PENDING'),
    kycRiskRating: text('kycRiskRating').notNull().default('MEDIUM'),
    kycReviewedAt: timestamp('kycReviewedAt', { withTimezone: true }),
    kycReviewerId: uuid('kycReviewerId'),
    kycExpiresAt: timestamp('kycExpiresAt', { withTimezone: true }),
    pepFlag: boolean('pepFlag').notNull().default(false),
    sanctionsFlag: boolean('sanctionsFlag').notNull().default(false),
    isBeneficialOwner: boolean('isBeneficialOwner').notNull().default(false),
    status: text('status').notNull().default('ACTIVE'),
    blacklistReason: text('blacklistReason'),
    branchId: uuid('branchId'),
    assignedOfficerId: uuid('assignedOfficerId'),
    createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
    createdById: uuid('createdById'),
    notes: text('notes'),
  },
  (t) => ({
    nrcIdx: index('Borrower_nrcNumber_idx').on(t.nrcNumber),
    phoneIdx: index('Borrower_phone_idx').on(t.phone),
    nameIdx: index('Borrower_lastName_firstName_idx').on(t.lastName, t.firstName),
    kycStatusIdx: index('Borrower_kycStatus_idx').on(t.kycStatus),
    branchIdx: index('Borrower_branchId_idx').on(t.branchId),
  }),
);

export const borrowerAddresses = pgTable('BorrowerAddress', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  borrowerId: uuid('borrowerId').notNull(),
  type: text('type').notNull(),
  line1: text('line1').notNull(),
  line2: text('line2'),
  city: text('city'),
  province: text('province'),
  country: text('country').notNull().default('Zambia'),
  fromDate: timestamp('fromDate', { withTimezone: true }),
  toDate: timestamp('toDate', { withTimezone: true }),
  isCurrent: boolean('isCurrent').notNull().default(true),
});

export const kycDocuments = pgTable(
  'KycDocument',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    borrowerId: uuid('borrowerId').notNull(),
    type: text('type').notNull(),
    documentNo: text('documentNo'),
    issuer: text('issuer'),
    issuedOn: timestamp('issuedOn', { withTimezone: true }),
    expiresOn: timestamp('expiresOn', { withTimezone: true }),
    fileName: text('fileName').notNull(),
    fileMime: text('fileMime').notNull(),
    fileSize: integer('fileSize').notNull(),
    storagePath: text('storagePath').notNull(),
    fileSha256: text('fileSha256').notNull(),
    ocrText: text('ocrText'),
    verified: boolean('verified').notNull().default(false),
    verifiedAt: timestamp('verifiedAt', { withTimezone: true }),
    verifiedById: uuid('verifiedById'),
    riskNotes: text('riskNotes'),
    createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    borrowerIdx: index('KycDocument_borrowerId_idx').on(t.borrowerId),
    typeIdx: index('KycDocument_type_idx').on(t.type),
  }),
);

export const beneficialOwners = pgTable(
  'BeneficialOwner',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    entityBorrowerId: uuid('entityBorrowerId').notNull(),
    uboBorrowerId: uuid('uboBorrowerId').notNull(),
    ownershipPct: doublePrecision('ownershipPct').notNull(),
    acquiredOn: timestamp('acquiredOn', { withTimezone: true }),
    verified: boolean('verified').notNull().default(false),
    verifiedAt: timestamp('verifiedAt', { withTimezone: true }),
    verifiedById: uuid('verifiedById'),
    notes: text('notes'),
  },
  (t) => ({
    pairIdx: uniqueIndex('BeneficialOwner_entity_ubo_idx').on(t.entityBorrowerId, t.uboBorrowerId),
    uboIdx: index('BeneficialOwner_uboBorrowerId_idx').on(t.uboBorrowerId),
  }),
);

export const nextOfKin = pgTable('NextOfKin', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  borrowerId: uuid('borrowerId').notNull(),
  fullName: text('fullName').notNull(),
  relationship: text('relationship').notNull(),
  phone: text('phone').notNull(),
  address: text('address'),
  isPrimary: boolean('isPrimary').notNull().default(false),
});

export const kycRiskAssessments = pgTable('KycRiskAssessment', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  borrowerId: uuid('borrowerId').notNull(),
  assessedAt: timestamp('assessedAt', { withTimezone: true }).notNull().defaultNow(),
  assessedById: uuid('assessedById'),
  riskRating: text('riskRating').notNull(),
  countryRiskScore: integer('countryRiskScore').notNull().default(0),
  productRiskScore: integer('productRiskScore').notNull().default(0),
  customerRiskScore: integer('customerRiskScore').notNull().default(0),
  transactionRiskScore: integer('transactionRiskScore').notNull().default(0),
  totalScore: integer('totalScore').notNull().default(0),
  findings: text('findings'),
  decision: text('decision').notNull(),
  decisionReason: text('decisionReason'),
  reviewDate: timestamp('reviewDate', { withTimezone: true }),
});

// -----------------------------------------------------------------------------
// LOANS
// -----------------------------------------------------------------------------

export const loanProducts = pgTable('LoanProduct', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  name: text('name').notNull().unique(),
  description: text('description'),
  interestRateAnnualPct: doublePrecision('interestRateAnnualPct').notNull(),
  interestMethod: text('interestMethod').notNull(),
  minTermMonths: integer('minTermMonths').notNull().default(1),
  maxTermMonths: integer('maxTermMonths').notNull().default(36),
  minAmountZMW: doublePrecision('minAmountZMW').notNull(),
  maxAmountZMW: doublePrecision('maxAmountZMW').notNull(),
  disbursementChannels: text('disbursementChannels').notNull(),
  repaymentFrequency: text('repaymentFrequency').notNull(),
  gracePeriodDays: integer('gracePeriodDays').notNull().default(0),
  applicationFeeZMW: doublePrecision('applicationFeeZMW').notNull().default(0),
  processingFeePct: doublePrecision('processingFeePct').notNull().default(0),
  requiresCollateral: boolean('requiresCollateral').notNull().default(false),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
});

export const loanApplications = pgTable(
  'LoanApplication',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    applicationNo: text('applicationNo').notNull().unique(),
    borrowerId: uuid('borrowerId').notNull(),
    productId: uuid('productId').notNull(),
    requestedAmountZMW: doublePrecision('requestedAmountZMW').notNull(),
    requestedTermMonths: integer('requestedTermMonths').notNull(),
    purpose: text('purpose').notNull(),
    purposeDetail: text('purposeDetail'),
    creditScore: integer('creditScore'),
    creditGrade: text('creditGrade'),
    creditFactors: text('creditFactors'),
    status: text('status').notNull().default('DRAFT'),
    approvedAmountZMW: doublePrecision('approvedAmountZMW'),
    approvedTermMonths: integer('approvedTermMonths'),
    approvedRatePct: doublePrecision('approvedRatePct'),
    rejectionReason: text('rejectionReason'),
    assignedOfficerId: uuid('assignedOfficerId'),
    submittedAt: timestamp('submittedAt', { withTimezone: true }),
    decisionedAt: timestamp('decisionedAt', { withTimezone: true }),
    decidedById: uuid('decidedById'),
    disbursedAt: timestamp('disbursedAt', { withTimezone: true }),
    disbursementMethod: text('disbursementMethod'),
    loanId: uuid('loanId').unique(),
    altDataSnapshot: text('altDataSnapshot'),
    createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    borrowerIdx: index('LoanApplication_borrowerId_idx').on(t.borrowerId),
    statusIdx: index('LoanApplication_status_idx').on(t.status),
  }),
);

export const loanApprovals = pgTable('LoanApproval', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  applicationId: uuid('applicationId').notNull(),
  approverId: uuid('approverId').notNull(),
  level: text('level').notNull(),
  decision: text('decision').notNull(),
  reason: text('reason'),
  decidedAt: timestamp('decidedAt', { withTimezone: true }).notNull().defaultNow(),
});

export const loans = pgTable(
  'Loan',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    loanNo: text('loanNo').notNull().unique(),
    borrowerId: uuid('borrowerId').notNull(),
    productId: uuid('productId').notNull(),
    branchId: uuid('branchId'),
    principalZMW: doublePrecision('principalZMW').notNull(),
    interestRateAnnualPct: doublePrecision('interestRateAnnualPct').notNull(),
    interestMethod: text('interestMethod').notNull(),
    termMonths: integer('termMonths').notNull(),
    disbursedAt: timestamp('disbursedAt', { withTimezone: true }),
    disbursementChannel: text('disbursementChannel'),
    disbursementRef: text('disbursementRef'),
    repaymentFrequency: text('repaymentFrequency').notNull(),
    installmentZMW: doublePrecision('installmentZMW').notNull(),
    totalRepayableZMW: doublePrecision('totalRepayableZMW').notNull(),
    firstPaymentDue: timestamp('firstPaymentDue', { withTimezone: true }),
    maturityDate: timestamp('maturityDate', { withTimezone: true }),
    status: text('status').notNull().default('PENDING_DISBURSEMENT'),
    daysInArrears: integer('daysInArrears').notNull().default(0),
    principalOutstandingZMW: doublePrecision('principalOutstandingZMW').notNull().default(0),
    interestOutstandingZMW: doublePrecision('interestOutstandingZMW').notNull().default(0),
    feesOutstandingZMW: doublePrecision('feesOutstandingZMW').notNull().default(0),
    totalOutstandingZMW: doublePrecision('totalOutstandingZMW').notNull().default(0),
    ifrs9Stage: integer('ifrs9Stage').notNull().default(1),
    eclProvisionZMW: doublePrecision('eclProvisionZMW').notNull().default(0),
    restructureCount: integer('restructureCount').notNull().default(0),
    collateral: text('collateral'),
    collateralValueZMW: doublePrecision('collateralValueZMW'),
    pricingOverrideReason: text('pricingOverrideReason'),
    createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp('updatedAt', { withTimezone: true }).notNull().defaultNow(),
    closedAt: timestamp('closedAt', { withTimezone: true }),
  },
  (t) => ({
    borrowerIdx: index('Loan_borrowerId_idx').on(t.borrowerId),
    statusIdx: index('Loan_status_idx').on(t.status),
    branchIdx: index('Loan_branchId_idx').on(t.branchId),
    ifrs9StageIdx: index('Loan_ifrs9Stage_idx').on(t.ifrs9Stage),
  }),
);

export const repaymentSchedule = pgTable(
  'RepaymentSchedule',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    loanId: uuid('loanId').notNull(),
    installmentNo: integer('installmentNo').notNull(),
    dueDate: timestamp('dueDate', { withTimezone: true }).notNull(),
    principalDue: doublePrecision('principalDue').notNull(),
    interestDue: doublePrecision('interestDue').notNull(),
    feesDue: doublePrecision('feesDue').notNull(),
    totalDue: doublePrecision('totalDue').notNull(),
    principalPaid: doublePrecision('principalPaid').notNull().default(0),
    interestPaid: doublePrecision('interestPaid').notNull().default(0),
    feesPaid: doublePrecision('feesPaid').notNull().default(0),
    totalPaid: doublePrecision('totalPaid').notNull().default(0),
    paidAt: timestamp('paidAt', { withTimezone: true }),
    status: text('status').notNull().default('PENDING'),
  },
  (t) => ({
    pairIdx: uniqueIndex('RepaymentSchedule_loan_installment_idx').on(t.loanId, t.installmentNo),
    dueStatusIdx: index('RepaymentSchedule_dueDate_status_idx').on(t.dueDate, t.status),
  }),
);

export const repayments = pgTable(
  'Repayment',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    receiptNo: text('receiptNo').notNull().unique(),
    loanId: uuid('loanId').notNull(),
    installmentId: uuid('installmentId'),
    recordedById: uuid('recordedById').notNull(),
    principalPaidZMW: doublePrecision('principalPaidZMW').notNull(),
    interestPaidZMW: doublePrecision('interestPaidZMW').notNull(),
    feesPaidZMW: doublePrecision('feesPaidZMW').notNull(),
    totalPaidZMW: doublePrecision('totalPaidZMW').notNull(),
    paymentMethod: text('paymentMethod').notNull(),
    paymentChannel: text('paymentChannel'),
    externalRef: text('externalRef'),
    paidByName: text('paidByName'),
    paidByRelation: text('paidByRelation'),
    status: text('status').notNull().default('POSTED'),
    reversedAt: timestamp('reversedAt', { withTimezone: true }),
    reversedReason: text('reversedReason'),
    triggersCtr: boolean('triggersCtr').notNull().default(false),
    triggersStr: boolean('triggersStr').notNull().default(false),
    receivedAt: timestamp('receivedAt', { withTimezone: true }).notNull().defaultNow(),
    postedAt: timestamp('postedAt', { withTimezone: true }).notNull().defaultNow(),
    notes: text('notes'),
  },
  (t) => ({
    loanIdx: index('Repayment_loanId_idx').on(t.loanId),
    receivedAtIdx: index('Repayment_receivedAt_idx').on(t.receivedAt),
  }),
);

// -----------------------------------------------------------------------------
// MOBILE MONEY
// -----------------------------------------------------------------------------

export const mobileMoneyTransactions = pgTable(
  'MobileMoneyTransaction',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    provider: text('provider').notNull(),
    externalId: text('externalId'),
    direction: text('direction').notNull(),
    amountZMW: doublePrecision('amountZMW').notNull(),
    feesZMW: doublePrecision('feesZMW').notNull().default(0),
    msisdn: text('msisdn').notNull(),
    accountRef: text('accountRef'),
    status: text('status').notNull().default('PENDING'),
    failureReason: text('failureReason'),
    repaymentId: uuid('repaymentId').unique(),
    webhookSignature: text('webhookSignature'),
    initiatedAt: timestamp('initiatedAt', { withTimezone: true }).notNull().defaultNow(),
    confirmedAt: timestamp('confirmedAt', { withTimezone: true }),
    rawCallback: text('rawCallback'),
  },
  (t) => ({
    externalIdIdx: index('MobileMoneyTransaction_externalId_idx').on(t.externalId),
    statusIdx: index('MobileMoneyTransaction_status_idx').on(t.status),
  }),
);

// -----------------------------------------------------------------------------
// AML / CFT
// -----------------------------------------------------------------------------

export const amlAlerts = pgTable(
  'AmlAlert',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    alertType: text('alertType').notNull(),
    severity: text('severity').notNull(),
    borrowerId: uuid('borrowerId'),
    loanId: uuid('loanId'),
    repaymentId: uuid('repaymentId'),
    triggeredAt: timestamp('triggeredAt', { withTimezone: true }).notNull().defaultNow(),
    ruleCode: text('ruleCode').notNull(),
    description: text('description').notNull(),
    evidenceJson: text('evidenceJson').notNull(),
    status: text('status').notNull().default('OPEN'),
    reviewedAt: timestamp('reviewedAt', { withTimezone: true }),
    reviewedById: uuid('reviewedById'),
    resolutionNotes: text('resolutionNotes'),
    ficReportId: text('ficReportId'),
    evidencePath: text('evidencePath'),
  },
  (t) => ({
    statusIdx: index('AmlAlert_status_idx').on(t.status),
    alertTypeIdx: index('AmlAlert_alertType_idx').on(t.alertType),
    triggeredAtIdx: index('AmlAlert_triggeredAt_idx').on(t.triggeredAt),
  }),
);

export const ctrRecords = pgTable('CtrRecord', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  alertId: uuid('alertId').notNull().unique(),
  borrowerId: uuid('borrowerId'),
  customerName: text('customerName').notNull(),
  customerNrc: text('customerNrc'),
  amountZMW: doublePrecision('amountZMW').notNull(),
  amountUSD: doublePrecision('amountUSD').notNull(),
  transactionDate: timestamp('transactionDate', { withTimezone: true }).notNull(),
  transactionType: text('transactionType').notNull(),
  status: text('status').notNull().default('DRAFT'),
  submittedAt: timestamp('submittedAt', { withTimezone: true }),
  ficRef: text('ficRef'),
  goamlXmlPath: text('goamlXmlPath'),
});

export const strRecords = pgTable('StrRecord', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  alertId: uuid('alertId').notNull().unique(),
  borrowerId: uuid('borrowerId'),
  subjectName: text('subjectName').notNull(),
  suspicionSummary: text('suspicionSummary').notNull(),
  amountZMW: doublePrecision('amountZMW'),
  filingReason: text('filingReason').notNull(),
  filingDeadline: timestamp('filingDeadline', { withTimezone: true }),
  status: text('status').notNull().default('DRAFT'),
  submittedAt: timestamp('submittedAt', { withTimezone: true }),
  ficRef: text('ficRef'),
  goamlXmlPath: text('goamlXmlPath'),
});

// -----------------------------------------------------------------------------
// NOTIFICATIONS
// -----------------------------------------------------------------------------

export const notifications = pgTable(
  'Notification',
  {
    id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
    userId: uuid('userId'),
    borrowerId: uuid('borrowerId'),
    channel: text('channel').notNull(),
    recipient: text('recipient').notNull(),
    subject: text('subject'),
    body: text('body').notNull(),
    status: text('status').notNull().default('PENDING'),
    sentAt: timestamp('sentAt', { withTimezone: true }),
    deliveredAt: timestamp('deliveredAt', { withTimezone: true }),
    failureReason: text('failureReason'),
    relatedEntity: text('relatedEntity'),
    relatedEntityId: text('relatedEntityId'),
    scheduledAt: timestamp('scheduledAt', { withTimezone: true }),
    createdAt: timestamp('createdAt', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => ({
    userIdx: index('Notification_userId_idx').on(t.userId),
    statusIdx: index('Notification_status_idx').on(t.status),
  }),
);

// -----------------------------------------------------------------------------
// BOZ REPORTS
// -----------------------------------------------------------------------------

export const bozReports = pgTable('BozReport', {
  id: uuid('id').primaryKey().default(sql`gen_random_uuid()`),
  reportType: text('reportType').notNull(),
  periodStart: timestamp('periodStart', { withTimezone: true }).notNull(),
  periodEnd: timestamp('periodEnd', { withTimezone: true }).notNull(),
  generatedAt: timestamp('generatedAt', { withTimezone: true }).notNull().defaultNow(),
  generatedById: uuid('generatedById'),
  payloadJson: text('payloadJson').notNull(),
  payloadSha256: text('payloadSha256').notNull(),
  status: text('status').notNull().default('DRAFT'),
  totalCapitalZMW: doublePrecision('totalCapitalZMW'),
  totalRiskWeightedAssetsZMW: doublePrecision('totalRiskWeightedAssetsZMW'),
  capitalAdequacyRatio: doublePrecision('capitalAdequacyRatio'),
  liquidAssetsZMW: doublePrecision('liquidAssetsZMW'),
  liquidityRatio: doublePrecision('liquidityRatio'),
  nplRatio: doublePrecision('nplRatio'),
  metricsJson: text('metricsJson'),
  filePath: text('filePath'),
  submittedToBoz: boolean('submittedToBoz').notNull().default(false),
  submittedAt: timestamp('submittedAt', { withTimezone: true }),
  bozReference: text('bozReference'),
});
