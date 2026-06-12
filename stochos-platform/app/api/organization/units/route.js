import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET() {
  try {
    const units = await prisma.orgUnit.findMany({
      include: {
        users: {
          select: { id: true, name: true, email: true, status: true }
        }
      },
      orderBy: { code: 'asc' }
    });

    return NextResponse.json({ success: true, units });
  } catch (error) {
    console.error('Error fetching organizational units:', error);
    return NextResponse.json({ error: 'Failed to fetch organizational units', details: error.message }, { status: 500 });
  }
}
