import { NextRequest, NextResponse } from 'next/server';
import { readJsonBody } from '@/lib/request-body';
import { z } from 'zod';
import { sql, or, ilike } from 'drizzle-orm';
import { db } from '@/lib/db';
import { borrowers } from '@/lib/db/schema';
import { getSessionFromRequest, AuthorizationError, requireSession } from '@/lib/auth';
import { audit } from '@/lib/audit';
import { nextBorrowerNo, normalizeNrc } from '@/lib/utils';

const schema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  middleName: z.string().optional(),
  dateOfBirth: z.string().optional(),
  gender: z.string().optional(),
  nrcNumber: z.string().optional(),
  phone: z.string().min(1),
  phoneAlt: z.string().optional(),
  email: z.string().email().optional().or(z.literal('')),
  addressLine1: z.string().optional(),
  city: z.string().optional(),
  province: z.string().optional(),
  district: z.string().optional(),
  employmentStatus: z.string().optional(),
  employerName: z.string().optional(),
  occupation: z.string().optional(),
  monthlyIncomeZMW: z.number().nullable().optional(),
  pepFlag: z.boolean().optional(),
  notes: z.string().optional(),
});

export async function POST(req: NextRequest) {
  let session: Awaited<ReturnType<typeof getSessionFromRequest>>;
  try {
    session = await getSessionFromRequest(req);
    requireSession(session, ['ADMIN', 'BRANCH_MANAGER', 'CREDIT_OFFICER', 'LOAN_OFFICER']);
  } catch (e) {
    if (e instanceof AuthorizationError) return NextResponse.json({ error: e.message }, { status: e.status });
    throw e;
  }
  const body = await readJsonBody(req);
  if (body === null) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
  }

  const countRows = await db.select({ c: sql<number>`count(*)::int` }).from(borrowers);
  const borrowerNo = nextBorrowerNo((countRows[0]?.c ?? 0) + 1);

  const [borrower] = await db.insert(borrowers).values({
    borrowerNo,
    firstName: parsed.data.firstName,
    lastName: parsed.data.lastName,
    middleName: parsed.data.middleName ?? null,
    dateOfBirth: parsed.data.dateOfBirth ? new Date(parsed.data.dateOfBirth) : null,
    gender: parsed.data.gender ?? null,
    nrcNumber: parsed.data.nrcNumber ? normalizeNrc(parsed.data.nrcNumber) : null,
    phone: parsed.data.phone,
    phoneAlt: parsed.data.phoneAlt ?? null,
    email: parsed.data.email || null,
    addressLine1: parsed.data.addressLine1 ?? null,
    city: parsed.data.city ?? null,
    province: parsed.data.province ?? null,
    district: parsed.data.district ?? null,
    employmentStatus: parsed.data.employmentStatus ?? null,
    employerName: parsed.data.employerName ?? null,
    occupation: parsed.data.occupation ?? null,
    monthlyIncomeZMW: parsed.data.monthlyIncomeZMW ?? null,
    pepFlag: parsed.data.pepFlag ?? false,
    notes: parsed.data.notes ?? null,
    assignedOfficerId: session!.userId,
    kycStatus: parsed.data.pepFlag ? 'IN_REVIEW' : 'PENDING',
    kycRiskRating: parsed.data.pepFlag ? 'HIGH' : 'MEDIUM',
  }).returning();

  await audit({
    userId: session!.userId,
    action: 'CREATE_BORROWER',
    entity: 'BORROWER',
    entityId: borrower.id,
    ipAddress: req.headers.get('x-forwarded-for') ?? null,
    userAgent: req.headers.get('user-agent') ?? null,
    meta: { borrowerNo },
  });

  return NextResponse.json({ ok: true, borrower });
}

export async function GET(req: NextRequest) {
  try {
    await getSessionFromRequest(req);
  } catch {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }
  const url = new URL(req.url);
  const q = url.searchParams.get('q') ?? '';
  const limit = Math.min(100, parseInt(url.searchParams.get('limit') ?? '25', 10));
  const filter = q
    ? or(
        ilike(borrowers.firstName, `%${q}%`),
        ilike(borrowers.lastName, `%${q}%`),
        ilike(borrowers.borrowerNo, `%${q}%`),
        ilike(borrowers.phone, `%${q}%`),
      )
    : undefined;
  const rows = await db
    .select({
      id: borrowers.id,
      borrowerNo: borrowers.borrowerNo,
      firstName: borrowers.firstName,
      lastName: borrowers.lastName,
      phone: borrowers.phone,
      kycStatus: borrowers.kycStatus,
    })
    .from(borrowers)
    .where(filter)
    .orderBy(sql`${borrowers.createdAt} DESC`)
    .limit(limit);
  return NextResponse.json({ borrowers: rows });
}
