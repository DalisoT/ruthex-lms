/**
 * Shared formatting and utility helpers.
 */

export function formatZMW(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return 'K0.00';
  return new Intl.NumberFormat('en-ZM', {
    style: 'currency',
    currency: 'ZMW',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatNumber(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '0';
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export function formatPercent(value: number | null | undefined, decimals = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '0%';
  return `${value.toFixed(decimals)}%`;
}

export function formatDate(value: Date | string | null | undefined, opts?: Intl.DateTimeFormatOptions): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  return d.toLocaleDateString('en-GB', opts ?? { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(value: Date | string | null | undefined): string {
  if (!value) return '—';
  const d = typeof value === 'string' ? new Date(value) : value;
  return d.toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

export function classNames(...values: Array<string | false | null | undefined>): string {
  return values.filter(Boolean).join(' ');
}

/** Compute amortization schedule (flat or reducing balance). */
export interface AmortizationInstallment {
  installmentNo: number;
  dueDate: Date;
  principalDue: number;
  interestDue: number;
  totalDue: number;
}

export function buildAmortization(
  principal: number,
  annualRatePct: number,
  termMonths: number,
  frequency: 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'LUMP_SUM',
  startDate: Date,
  method: 'FLAT' | 'REDUCING_BALANCE' = 'REDUCING_BALANCE'
): AmortizationInstallment[] {
  // Map frequency to instalments per year for the periodic rate
  const periodsPerYear = (() => {
    switch (frequency) {
      case 'DAILY': return 365;
      case 'WEEKLY': return 52;
      case 'BIWEEKLY': return 26;
      case 'MONTHLY': return 12;
      case 'LUMP_SUM': return 1;
    }
  })();
  const totalInstallments = frequency === 'LUMP_SUM' ? 1 : termMonths * (periodsPerYear / 12);
  const periodicRate = annualRatePct / 100 / periodsPerYear;

  // Periodic payment for a fully amortising loan (reducing balance)
  let periodicPayment: number;
  if (method === 'REDUCING_BALANCE' && totalInstallments > 1) {
    periodicPayment = principal * (periodicRate * Math.pow(1 + periodicRate, totalInstallments)) /
      (Math.pow(1 + periodicRate, totalInstallments) - 1);
  } else if (method === 'FLAT' && totalInstallments > 1) {
    const totalInterest = principal * (annualRatePct / 100) * (termMonths / 12);
    periodicPayment = (principal + totalInterest) / totalInstallments;
  } else {
    periodicPayment = principal * (1 + (annualRatePct / 100) * (termMonths / 12));
  }

  const installments: AmortizationInstallment[] = [];
  let balance = principal;
  let cursor = new Date(startDate);
  for (let i = 1; i <= Math.max(1, Math.floor(totalInstallments)); i++) {
    const interestDue = balance * periodicRate;
    const principalDue = Math.max(0, Math.min(balance, periodicPayment - interestDue));
    balance = Math.max(0, balance - principalDue);
    installments.push({
      installmentNo: i,
      dueDate: new Date(cursor),
      principalDue,
      interestDue,
      totalDue: principalDue + interestDue,
    });
    // Advance cursor
    switch (frequency) {
      case 'DAILY': cursor.setDate(cursor.getDate() + 1); break;
      case 'WEEKLY': cursor.setDate(cursor.getDate() + 7); break;
      case 'BIWEEKLY': cursor.setDate(cursor.getDate() + 14); break;
      case 'MONTHLY': cursor.setMonth(cursor.getMonth() + 1); break;
      case 'LUMP_SUM': cursor.setMonth(cursor.getMonth() + termMonths); break;
    }
  }
  return installments;
}

/** Generate the next borrowerNo (internal reference). */
export function nextBorrowerNo(seq: number): string {
  return `RB-${String(seq).padStart(7, '0')}`;
}

/** Generate the next loanNo. */
export function nextLoanNo(seq: number): string {
  return `LN-${String(seq).padStart(7, '0')}`;
}

/** Generate the next applicationNo. */
export function nextApplicationNo(seq: number): string {
  return `APP-${String(seq).padStart(7, '0')}`;
}

/** Generate the next receiptNo. */
export function nextReceiptNo(seq: number): string {
  return `RCT-${String(seq).padStart(7, '0')}`;
}

/** Convert Zambian NRC format (e.g. 123456/78/9) to canonical form. */
export function normalizeNrc(input: string): string {
  const digits = input.replace(/[^\d]/g, '');
  if (digits.length === 9) return `${digits.slice(0, 6)}/${digits.slice(6, 8)}/${digits.slice(8)}`;
  return input.trim();
}

/** ISO timestamp string for filenames. */
export function timestampSlug(): string {
  return new Date().toISOString().replace(/[:.]/g, '-');
}
