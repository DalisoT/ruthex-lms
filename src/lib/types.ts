/**
 * RUTHEX Lending Institution — domain constants and types.
 *
 * These mirror the regulatory definitions from:
 *   - Banking and Financial Services Act 2017 (BFSA)
 *   - Banking and Financial Services (Microfinance) Regulations 2006
 *   - Banking and Financial Services Act 2026 (BFSA 2026, transitional)
 *   - Bank of Zambia Fit and Proper Guidelines (29 Dec 2023)
 *   - Financial Intelligence Centre Act 2010 and S.I. 52 of 2016 (CTR threshold)
 *   - Data Protection Act 2021
 *   - Co-operative Societies Act 1998 (for SACCO membership scenarios)
 */

// -----------------------------------------------------------------------------
// USER ROLES (RBAC)
// -----------------------------------------------------------------------------

export const ROLES = [
  'ADMIN',
  'BRANCH_MANAGER',
  'CREDIT_OFFICER',
  'LOAN_OFFICER',
  'CASHIER',
  'COMPLIANCE_OFFICER',
  'AUDITOR',
] as const;
export type Role = (typeof ROLES)[number];

// -----------------------------------------------------------------------------
// AML THRESHOLDS
// -----------------------------------------------------------------------------

/** Currency Transaction Report threshold per S.I. 52 of 2016. */
export const CTR_THRESHOLD_USD = 10_000;
/** STR filing deadline is 2 working days per FIC guidelines. */
export const STR_FILING_DEADLINE_DAYS = 2;

// -----------------------------------------------------------------------------
// LOAN STATUSES
// -----------------------------------------------------------------------------

export const LOAN_STATUSES = [
  'PENDING_DISBURSEMENT',
  'ACTIVE',
  'IN_ARREARS',
  'RESTRUCTURED',
  'WRITTEN_OFF',
  'CLOSED',
  'DEFAULTED',
] as const;
export type LoanStatus = (typeof LOAN_STATUSES)[number];

export const APPLICATION_STATUSES = [
  'DRAFT',
  'SUBMITTED',
  'UNDER_REVIEW',
  'APPROVED',
  'REJECTED',
  'WITHDRAWN',
  'DISBURSED',
] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

// -----------------------------------------------------------------------------
// REPAYMENT METHODS
// -----------------------------------------------------------------------------

export const PAYMENT_METHODS = ['CASH', 'MOBILE_MONEY', 'BANK_TRANSFER', 'CHEQUE', 'OFFSET'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const MOBILE_MONEY_PROVIDERS = ['MTN', 'AIRTEL', 'ZAMTEL', 'MOCK'] as const;
export type MobileMoneyProvider = (typeof MOBILE_MONEY_PROVIDERS)[number];

// -----------------------------------------------------------------------------
// KYC STATUS / RISK
// -----------------------------------------------------------------------------

export const KYC_STATUSES = ['PENDING', 'IN_REVIEW', 'APPROVED', 'REJECTED', 'EXPIRED'] as const;
export const KYC_RISK_RATINGS = ['LOW', 'MEDIUM', 'HIGH', 'PROHIBITED'] as const;
export const AML_ALERT_TYPES = [
  'CTR',
  'STR',
  'SANCTIONS_HIT',
  'KYC_RISK',
  'UNUSUAL_PATTERN',
] as const;
export const AML_ALERT_SEVERITIES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;

// -----------------------------------------------------------------------------
// DOCUMENT TYPES (KYC vault)
// -----------------------------------------------------------------------------

export const DOCUMENT_TYPES = [
  'NRC',
  'PASSPORT',
  'UTILITY_BILL',
  'PAYSLIP',
  'BANK_STATEMENT',
  'BUSINESS_REG',
  'TIN_CERT',
  'SELFIE',
  'SIGNATURE',
  'COLLATERAL_DOC',
  'OTHER',
] as const;

// -----------------------------------------------------------------------------
// BOZ REGULATORY CONSTANTS
// -----------------------------------------------------------------------------

/** Per Capital Adequacy Rules 2025 (S.I. 62/2025) — MFIs face a 15% CAR floor. */
export const MFI_MIN_CAR_PCT = 15.0;
/** Regulatory capital floor (ZMW) for NDT MFI per BOZ published rates. */
export const NDT_MFI_MIN_CAPITAL_ZMW = 100_000;
/** ZMW equivalent of USD 10,000 — historical rule of thumb used by NBFIs. */
export const CTR_THRESHOLD_ZMW_REFERENCE = 100_000;

// -----------------------------------------------------------------------------
// INTEREST / PRICING
// -----------------------------------------------------------------------------

export const INTEREST_METHODS = ['FLAT', 'REDUCING_BALANCE', 'COMPOUND'] as const;
export const REPAYMENT_FREQUENCIES = ['DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'LUMP_SUM'] as const;

// -----------------------------------------------------------------------------
// HELPER GUARDS
// -----------------------------------------------------------------------------

export function isRole(value: unknown): value is Role {
  return typeof value === 'string' && (ROLES as readonly string[]).includes(value);
}

export function isLoanStatus(value: unknown): value is LoanStatus {
  return typeof value === 'string' && (LOAN_STATUSES as readonly string[]).includes(value);
}

export function isApplicationStatus(value: unknown): value is ApplicationStatus {
  return typeof value === 'string' && (APPLICATION_STATUSES as readonly string[]).includes(value);
}
