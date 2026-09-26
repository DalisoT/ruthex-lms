import { NextRequest, NextResponse } from 'next/server';
import { readJsonBody } from '@/lib/request-body';
import { z } from 'zod';
import crypto from 'crypto';
import { eq, and, inArray } from 'drizzle-orm';
import { db } from '@/lib/db';
import { borrowers, kycDocuments, loanApplications } from '@/lib/db/schema';

const schema = z.object({
  borrowerId: z.string().min(1),
  idFileName: z.string().min(1),
  selfieName: z.string().min(1),
});

export async function POST(req: NextRequest) {
  const body = await readJsonBody(req);
  if (body === null) return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  const rows = await db.select().from(borrowers).where(eq(borrowers.id, parsed.data.borrowerId)).limit(1);
  const borrower = rows[0];
  if (!borrower) return NextResponse.json({ error: 'Borrower not found' }, { status: 404 });

  const now = new Date();
  const idHash = crypto.createHash('sha256').update(`${parsed.data.idFileName}|${borrower.id}|${now.toISOString()}`).digest('hex');
  const selfieHash = crypto.createHash('sha256').update(`${parsed.data.selfieName}|${borrower.id}|${now.toISOString()}`).digest('hex');

  await db.insert(kycDocuments).values([
    {
      borrowerId: borrower.id,
      type: 'NRC',
      documentNo: borrower.nrcNumber ?? null,
      issuer: 'Government of Zambia',
      fileName: parsed.data.idFileName,
      fileMime: 'image/jpeg',
      fileSize: 0,
      storagePath: `/var/ruthex/uploads/${parsed.data.idFileName}`,
      fileSha256: idHash,
      verified: false,
    },
    {
      borrowerId: borrower.id,
      type: 'SELFIE',
      fileName: parsed.data.selfieName,
      fileMime: 'image/jpeg',
      fileSize: 0,
      storagePath: `/var/ruthex/uploads/${parsed.data.selfieName}`,
      fileSha256: selfieHash,
      verified: false,
    },
  ]);

  await db.update(borrowers).set({ kycStatus: 'IN_REVIEW' }).where(eq(borrowers.id, borrower.id));

  const pendingLoans = await db
    .select({ id: loanApplications.id })
    .from(loanApplications)
    .where(and(eq(loanApplications.borrowerId, borrower.id), eq(loanApplications.status, 'SUBMITTED')));

  return NextResponse.json({ ok: true, pendingLoans: pendingLoans.length });
}
