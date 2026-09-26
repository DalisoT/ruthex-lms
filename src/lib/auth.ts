/**
 * RUTHEX Lending Institution — authentication & RBAC.
 *
 * Uses bcrypt for password hashing and HS256 JWT for session tokens.
 * Designed for the BOZ fit-and-proper expectations: each user has a stable
 * role, branch, and a `fitProperStatus` flag for senior officers.
 */
import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify } from 'jose';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { db } from './db';
import { users } from './db/schema';
import { Role } from './types';

const SESSION_COOKIE = 'ruthex_session';
const SESSION_TTL_HOURS = Number(process.env.SESSION_TTL_HOURS ?? 8);
const JWT_SECRET = process.env.JWT_SECRET ?? 'dev-only-do-not-use-in-production';

function getSecretKey(): Uint8Array {
  return new TextEncoder().encode(JWT_SECRET);
}

export interface SessionPayload {
  userId: string;
  email: string;
  role: Role;
  branchId: string | null;
}

// -----------------------------------------------------------------------------
// PASSWORD HASHING
// -----------------------------------------------------------------------------

export async function hashPassword(plaintext: string): Promise<string> {
  return bcrypt.hash(plaintext, 12);
}

export async function verifyPassword(plaintext: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plaintext, hash);
}

// -----------------------------------------------------------------------------
// JWT ISSUANCE / VERIFICATION
// -----------------------------------------------------------------------------

export async function issueSessionToken(payload: SessionPayload): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setIssuer('ruthex-lms')
    .setExpirationTime(`${SESSION_TTL_HOURS}h`)
    .sign(getSecretKey());
}

export async function verifySessionToken(token: string): Promise<SessionPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), { issuer: 'ruthex-lms' });
    if (typeof payload.userId !== 'string' || typeof payload.email !== 'string' || typeof payload.role !== 'string') {
      return null;
    }
    return {
      userId: payload.userId as string,
      email: payload.email as string,
      role: payload.role as Role,
      branchId: (payload.branchId as string | null) ?? null,
    };
  } catch {
    return null;
  }
}

// -----------------------------------------------------------------------------
// COOKIE HELPERS
// -----------------------------------------------------------------------------

export async function setSessionCookie(token: string) {
  cookies().set({
    name: SESSION_COOKIE,
    value: token,
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: SESSION_TTL_HOURS * 60 * 60,
  });
}

export async function clearSessionCookie() {
  cookies().set({
    name: SESSION_COOKIE,
    value: '',
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
}

// -----------------------------------------------------------------------------
// HIGH-LEVEL AUTH
// -----------------------------------------------------------------------------

/** Get current session from request (used in API routes). */
export async function getSessionFromRequest(req: NextRequest): Promise<SessionPayload | null> {
  const token = req.cookies.get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

/** Get current session in server components. */
export async function getCurrentSession(): Promise<SessionPayload | null> {
  const token = cookies().get(SESSION_COOKIE)?.value;
  if (!token) return null;
  return verifySessionToken(token);
}

/** Login by email + password. Returns session token or null. */
export async function login(email: string, password: string): Promise<{ token: string; payload: SessionPayload } | null> {
  const rows = await db.select().from(users).where(eq(users.email, email)).limit(1);
  const user = rows[0];
  if (!user || !user.active) return null;
  const ok = await verifyPassword(password, user.passwordHash);
  if (!ok) {
    await db
      .update(users)
      .set({ failedLoginCount: (user.failedLoginCount ?? 0) + 1 })
      .where(eq(users.id, user.id));
    return null;
  }
  const payload: SessionPayload = {
    userId: user.id,
    email: user.email,
    role: user.role as Role,
    branchId: user.branchId,
  };
  const token = await issueSessionToken(payload);
  await db
    .update(users)
    .set({ failedLoginCount: 0, lastLoginAt: new Date() })
    .where(eq(users.id, user.id));
  return { token, payload };
}

/**
 * Authorization guard. Throws an error with a status code the API layer can
 * catch if the session is missing or the role doesn't match.
 */
export class AuthorizationError extends Error {
  status: number;
  constructor(message: string, status: number = 401) {
    super(message);
    this.status = status;
  }
}

export function requireSession(session: SessionPayload | null, allowedRoles?: Role[]): SessionPayload {
  if (!session) throw new AuthorizationError('Not authenticated', 401);
  if (allowedRoles && !allowedRoles.includes(session.role)) {
    throw new AuthorizationError('Forbidden — role not permitted', 403);
  }
  return session;
}
