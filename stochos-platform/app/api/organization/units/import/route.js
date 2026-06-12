import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { parse } from 'csv-parse/sync';
import { auth } from '@/lib/auth';
import { acquireLock, releaseLock } from '@/lib/jobLock';

export async function POST(request) {
  const session = await auth();
  const userId = session?.user?.id || 'system';
  const userName = session?.user?.name || 'System';

  const lockKey = 'org-units-import';
  const lockResult = await acquireLock(
    lockKey,
    userId,
    userName,
    'Upload & Apply Organizational Hierarchy',
    60
  );

  if (!lockResult.success) {
    return NextResponse.json(
      { error: `A job is currently running on the server: ${lockResult.activeLock.description} started by ${lockResult.activeLock.userName}.` },
      { status: 429 }
    );
  }

  try {
    const formData = await request.formData();
    const file = formData.get('file');

    if (!file) {
      return NextResponse.json({ error: 'Missing CSV file.' }, { status: 400 });
    }

    const fileContent = await file.text();
    
    // Parse CSV
    const records = parse(fileContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    if (records.length === 0) {
      return NextResponse.json({ error: 'No valid records found in CSV.' }, { status: 400 });
    }

    // Validate headers
    const requiredHeaders = ['Code', 'Name', 'Type', 'ParentCode'];
    const headers = Object.keys(records[0]);
    const missingHeaders = requiredHeaders.filter(h => !headers.includes(h));
    if (missingHeaders.length > 0) {
      return NextResponse.json({ 
        error: `Invalid CSV template. Missing headers: ${missingHeaders.join(', ')}` 
      }, { status: 400 });
    }

    // Run transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create or update nodes (setting parentId to null for now)
      for (const row of records) {
        const code = row.Code;
        const name = row.Name;
        const type = row.Type.toUpperCase(); // e.g. COMMISSION, EXECUTIVE, DIVISION, BUREAU, SUBUNIT

        await tx.orgUnit.upsert({
          where: { code },
          update: { name, type },
          create: { code, name, type },
        });
      }

      // 2. Resolve parent-child relations
      let updatedCount = 0;
      for (const row of records) {
        const code = row.Code;
        const parentCode = row.ParentCode;

        if (parentCode) {
          // Find parent id
          const parentUnit = await tx.orgUnit.findUnique({
            where: { code: parentCode }
          });

          if (parentUnit) {
            await tx.orgUnit.update({
              where: { code },
              data: { parentId: parentUnit.id }
            });
            updatedCount++;
          }
        } else {
          // Remove parentId if it was set before but is now empty
          await tx.orgUnit.update({
            where: { code },
            data: { parentId: null }
          });
        }
      }

      return { upserted: records.length, linked: updatedCount };
    });

    return NextResponse.json({
      success: true,
      message: `Successfully processed ${result.upserted} organizational units and linked ${result.linked} parent relationships.`,
      details: result
    });

  } catch (error) {
    console.error('Error importing organizational units:', error);
    return NextResponse.json({
      error: 'Failed to process organizational unit upload',
      details: error.message
    }, { status: 500 });
  } finally {
    await releaseLock(lockKey);
  }
}
