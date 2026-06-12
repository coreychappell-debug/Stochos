import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const jurisdictionId = searchParams.get('jurisdictionId') || 'NY-LOTTERY';

    const rows = await prisma.gasbRow.findMany({
      where: { jurisdictionId },
      orderBy: { sortOrder: 'asc' }
    });

    return NextResponse.json({ success: true, rows });
  } catch (error) {
    console.error('Error fetching GASB rows:', error);
    return NextResponse.json({ success: false, error: 'Failed to fetch row definitions', details: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { jurisdictionId, rows } = body;

    if (!jurisdictionId || !Array.isArray(rows)) {
      return NextResponse.json({ success: false, error: 'Invalid payload: jurisdictionId and rows array required' }, { status: 400 });
    }

    // Run in transaction to update rows atomically
    await prisma.$transaction(async (tx) => {
      // Clear old rows for the jurisdiction
      await tx.gasbRow.deleteMany({
        where: { jurisdictionId }
      });

      // Insert new rows
      for (const row of rows) {
        await tx.gasbRow.create({
          data: {
            jurisdictionId,
            statement: row.statement,
            section: row.section,
            label: row.label,
            accountPattern: row.accountPattern || '',
            rowType: row.rowType || 'data',
            signageMultiplier: parseFloat(row.signageMultiplier || 1.0),
            sortOrder: parseInt(row.sortOrder || 10)
          }
        });
      }
    });

    // Fetch refreshed list
    const refreshed = await prisma.gasbRow.findMany({
      where: { jurisdictionId },
      orderBy: { sortOrder: 'asc' }
    });

    return NextResponse.json({ success: true, rows: refreshed });
  } catch (error) {
    console.error('Error saving GASB rows:', error);
    return NextResponse.json({ success: false, error: 'Failed to save row definitions', details: error.message }, { status: 500 });
  }
}
