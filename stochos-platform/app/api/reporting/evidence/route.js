import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import crypto from 'crypto';
import fs from 'fs';
import path from 'path';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const packageId = searchParams.get('packageId');
    const sectionId = searchParams.get('sectionId');
    const importBatchId = searchParams.get('importBatchId');

    const where = {};
    if (packageId) where.packageId = packageId;
    if (sectionId) where.sectionId = sectionId;
    if (importBatchId) where.importBatchId = importBatchId;

    const evidence = await prisma.supportingEvidence.findMany({
      where,
      orderBy: { uploadedAt: 'desc' }
    });

    return NextResponse.json({ success: true, evidence });
  } catch (error) {
    console.error('Error fetching evidence:', error);
    return NextResponse.json({ error: 'Failed to fetch evidence', details: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    const file = formData.get('file');
    const packageId = formData.get('packageId') || null;
    const sectionId = formData.get('sectionId') || null;
    const importBatchId = formData.get('importBatchId') || null;
    const isConfidential = formData.get('isConfidential') === 'true';
    const uploadedBy = formData.get('uploadedBy') || 'system';

    if (!file) {
      return NextResponse.json({ error: 'No file provided in form upload.' }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    
    // Compute SHA-256 hash of the uploaded file
    const fileHash = crypto.createHash('sha256').update(buffer).digest('hex');
    const fileSizeBytes = buffer.length;

    // Local uploads directory (acting as mock S3 bucket)
    const uploadDir = path.join(process.cwd(), 'public', 'uploads', 'evidence');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const storageFilename = `${fileHash.slice(0, 12)}-${file.name}`;
    const storagePath = path.join(uploadDir, storageFilename);
    fs.writeFileSync(storagePath, buffer);

    // Create database entry for compliance tracking
    const evidenceEntry = await prisma.$transaction(async (tx) => {
      const entry = await tx.supportingEvidence.create({
        data: {
          packageId,
          sectionId,
          importBatchId,
          fileName: file.name,
          fileHash,
          fileSizeBytes,
          storagePath: `/uploads/evidence/${storageFilename}`,
          isConfidential,
          uploadedBy
        }
      });

      // Write entry to audit logs
      await tx.auditLog.create({
        data: {
          userId: uploadedBy === 'system' ? (await tx.user.findFirst()).id : uploadedBy,
          entityType: 'evidence',
          entityId: entry.id,
          action: 'create',
          changes: JSON.stringify({
            fileName: file.name,
            fileHash,
            isConfidential
          })
        }
      });

      return entry;
    });

    return NextResponse.json({ success: true, evidence: evidenceEntry });

  } catch (error) {
    console.error('Error uploading evidence:', error);
    return NextResponse.json({ error: 'Failed to upload evidence', details: error.message }, { status: 500 });
  }
}
