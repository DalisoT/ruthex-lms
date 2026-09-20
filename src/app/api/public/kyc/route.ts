import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import crypto from 'crypto';
import { prisma } from '@/lib/db';

const schema = z.object({
  borrowerId: z.string().min(1),
  idFileName: z.string().min(1),
  selfieName: z.string().min(1),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try { body = await req.json(); } catch { return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
  const borrower = await prisma.borrower.findUnique({ where: { id: parsed.data.borrowerId } });
  if (!borrower) return NextResponse.json({ error: 'Borrower not found' }, { status: 404 });

  // In production, the actual files would be uploaded to S3 / local disk.
  // Here we just record placeholder KycDocument rows with deterministic hashes.
  const now = new Date();
  const idHash = crypto.createHash('sha256').update(`${parsed.data.idFileName}|${borrower.id}|${now.toISOString()}`).digest('hex');
  const selfieHash = crypto.createHash('sha256').update(`${parsed.data.selfieName}|${borrower.id}|${now.toISOString()}`).digest('hex');

  await prisma.kycDocument.createMany({
    data: [
      {
        borrowerId: borrower.id,
        type: 'NRC',
        documentNo: borrower.nrcNumber,
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
    ],
  });

  await prisma.borrower.update({
    where: { id: borrower.id },
    data: { kycStatus: 'IN_REVIEW' },
  });

  const pendingLoans = await prisma.loanApplication.count({ where: { borrowerId: borrower.id, status: 'SUBMITTED' } });
  return NextResponse.json({ ok: true, pendingLoans });
}
