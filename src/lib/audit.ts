/**
 * Audit trail with cryptographic hash chaining.
 *
 * Every privileged action goes through `audit()`. Each entry stores the SHA-256
 * of (prevHash || action || entityId || occurredAt || userId). This makes the
 * log tamper-evident: any modification to a historical row breaks the chain.
 * Useful for both internal governance and BOZ prudential inspections.
 */
import crypto from 'crypto';
import { desc, asc } from 'drizzle-orm';
import { db } from './db';
import { auditLogs } from './db/schema';

export type AuditAction =
  | 'LOGIN' | 'LOGIN_FAILED' | 'LOGOUT'
  | 'CREATE_BORROWER' | 'UPDATE_BORROWER' | 'BLACKLIST_BORROWER'
  | 'UPLOAD_DOCUMENT' | 'VERIFY_DOCUMENT'
  | 'KYC_REVIEW' | 'KYC_APPROVED' | 'KYC_REJECTED'
  | 'CREATE_LOAN_APPLICATION' | 'SUBMIT_LOAN_APPLICATION'
  | 'APPROVE_LOAN' | 'REJECT_LOAN' | 'WITHDRAW_APPLICATION'
  | 'DISBURSE_LOAN'
  | 'RECORD_REPAYMENT' | 'REVERSE_REPAYMENT'
  | 'MM_REQUEST' | 'MM_CALLBACK'
  | 'CTR_GENERATED' | 'STR_GENERATED' | 'CTR_FILED' | 'STR_FILED'
  | 'BOZ_REPORT_GENERATED' | 'BOZ_REPORT_SUBMITTED'
  | 'CREATE_USER' | 'UPDATE_USER' | 'DEACTIVATE_USER'
  | 'PERMISSIONS_CHANGED'
  | 'EXPORT_DATA' | 'VIEW_PII'
  | (string & {}); // allow extension

function sha256(input: string): string {
  return crypto.createHash('sha256').update(input).digest('hex');
}

export interface AuditInput {
  userId?: string | null;
  action: AuditAction;
  entity: string;
  entityId?: string | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  meta?: Record<string, unknown>;
}

export async function audit(input: AuditInput): Promise<void> {
  const occurredAt = new Date();
  // Find the previous audit row (for hash chaining)
  const prevRows = await db
    .select({ hash: auditLogs.hash })
    .from(auditLogs)
    .orderBy(desc(auditLogs.occurredAt))
    .limit(1);
  const prevHash = prevRows[0]?.hash ?? null;
  const base = [
    prevHash ?? '',
    input.action,
    input.entity,
    input.entityId ?? '',
    occurredAt.toISOString(),
    input.userId ?? '',
    JSON.stringify(input.meta ?? {}),
  ].join('|');
  const hash = sha256(base);
  await db.insert(auditLogs).values({
    occurredAt,
    userId: input.userId ?? null,
    action: input.action,
    entity: input.entity,
    entityId: input.entityId ?? null,
    ipAddress: input.ipAddress ?? null,
    userAgent: input.userAgent ?? null,
    prevHash,
    hash,
    meta: input.meta ? JSON.stringify(input.meta) : null,
  });
}

/**
 * Verify hash-chain integrity. Returns the first broken row index, or null if
 * the chain is intact. Useful for a periodic integrity sweep.
 */
export async function verifyAuditChain(): Promise<{ ok: true } | { ok: false; brokenAt: string }> {
  let cursor = 0;
  let prevHash: string | null = null;
  const rows = await db
    .select({
      id: auditLogs.id,
      occurredAt: auditLogs.occurredAt,
      action: auditLogs.action,
      entity: auditLogs.entity,
      entityId: auditLogs.entityId,
      userId: auditLogs.userId,
      meta: auditLogs.meta,
      prevHash: auditLogs.prevHash,
      hash: auditLogs.hash,
    })
    .from(auditLogs)
    .orderBy(asc(auditLogs.occurredAt));
  for (const row of rows) {
    cursor += 1;
    if ((row.prevHash ?? null) !== prevHash) {
      return { ok: false, brokenAt: row.id };
    }
    const base = [
      row.prevHash ?? '',
      row.action,
      row.entity,
      row.entityId ?? '',
      row.occurredAt.toISOString(),
      row.userId ?? '',
      row.meta ?? '',
    ].join('|');
    const expected = sha256(base);
    if (expected !== row.hash) {
      return { ok: false, brokenAt: row.id };
    }
    prevHash = row.hash;
  }
  return { ok: true };
}
