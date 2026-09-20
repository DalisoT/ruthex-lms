/**
 * RBAC enforcement helpers — server side.
 *
 * Use `requireRole()` in server components, layout, and route handlers. For
 * client components use the `<Can>` helper in `src/components/Can.tsx`.
 */
import { redirect } from 'next/navigation';
import { getCurrentSession, SessionPayload, AuthorizationError } from './auth';
import { Role } from './types';

export const ALL_ROLES: Role[] = ['ADMIN', 'BRANCH_MANAGER', 'CREDIT_OFFICER', 'LOAN_OFFICER', 'CASHIER', 'COMPLIANCE_OFFICER', 'AUDITOR'];

/**
 * Role grouping for coarse-grained UI hiding. A page that requires one of
 * these groups passes if the user's role is in the set.
 */
export const ROLE_GROUPS = {
  // Anything admin-only
  admin: ['ADMIN'] as Role[],
  // Anything compliance / audit
  compliance: ['ADMIN', 'COMPLIANCE_OFFICER', 'AUDITOR'] as Role[],
  // Anything that touches money (repayments / disbursements)
  cash: ['ADMIN', 'BRANCH_MANAGER', 'CASHIER', 'CREDIT_OFFICER'] as Role[],
  // Anything that touches lending (loans / applications / approvals)
  lending: ['ADMIN', 'BRANCH_MANAGER', 'CREDIT_OFFICER', 'LOAN_OFFICER'] as Role[],
  // Anything that touches borrowers (onboarding / KYC)
  borrowers: ['ADMIN', 'BRANCH_MANAGER', 'CREDIT_OFFICER', 'LOAN_OFFICER', 'COMPLIANCE_OFFICER'] as Role[],
  // Reports (everyone can view; some can snapshot)
  reportsView: ['ADMIN', 'BRANCH_MANAGER', 'CREDIT_OFFICER', 'COMPLIANCE_OFFICER', 'AUDITOR'] as Role[],
  reportsSnapshot: ['ADMIN', 'COMPLIANCE_OFFICER', 'AUDITOR'] as Role[],
} as const;

/**
 * Server-side role guard. Use in layouts and server components to redirect
 * users without the required role. Pass a list of allowed roles, or use the
 * `ROLE_GROUPS` shorthand.
 */
export async function requireRole(allowed: Role[] | keyof typeof ROLE_GROUPS): Promise<SessionPayload> {
  const session = await getCurrentSession();
  if (!session) redirect('/login');
  const allowedRoles = Array.isArray(allowed) ? allowed : ROLE_GROUPS[allowed];
  if (!allowedRoles.includes(session.role)) {
    redirect('/dashboard?forbidden=1');
  }
  return session;
}

/**
 * Server-side guard that throws instead of redirecting. Use in API route
 * handlers where a 401/403 JSON response is the right answer.
 */
export function assertRole(session: SessionPayload | null, allowed: Role[] | keyof typeof ROLE_GROUPS): SessionPayload {
  if (!session) throw new AuthorizationError('Not authenticated', 401);
  const allowedRoles = Array.isArray(allowed) ? allowed : ROLE_GROUPS[allowed];
  if (!allowedRoles.includes(session.role)) {
    throw new AuthorizationError('Forbidden', 403);
  }
  return session;
}

/** Human-friendly role label for the UI. */
export function roleLabel(role: Role): string {
  const map: Record<Role, string> = {
    ADMIN: 'Administrator',
    BRANCH_MANAGER: 'Branch Manager',
    CREDIT_OFFICER: 'Credit Officer',
    LOAN_OFFICER: 'Loan Officer',
    CASHIER: 'Cashier',
    COMPLIANCE_OFFICER: 'Compliance Officer',
    AUDITOR: 'Auditor',
  };
  return map[role] ?? role;
}
