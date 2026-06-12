import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (id) {
      const jurisdiction = await prisma.jurisdiction.findUnique({
        where: { id }
      });
      if (!jurisdiction) {
        return NextResponse.json({ error: 'Jurisdiction not found' }, { status: 404 });
      }
      return NextResponse.json({ success: true, jurisdiction });
    }

    const jurisdictions = await prisma.jurisdiction.findMany({
      where: { status: 'active' }
    });
    return NextResponse.json({ success: true, jurisdictions });
  } catch (error) {
    console.error('Error fetching jurisdiction:', error);
    return NextResponse.json({ error: 'Failed to fetch jurisdiction', details: error.message }, { status: 500 });
  }
}
