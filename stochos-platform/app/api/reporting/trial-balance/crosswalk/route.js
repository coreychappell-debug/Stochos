import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const jurisdictionId = searchParams.get('jurisdictionId') || 'NY-LOTTERY';

    const rules = await prisma.glCrosswalkRule.findMany({
      where: { jurisdictionId },
      orderBy: { accountPattern: 'asc' }
    });

    return NextResponse.json({ success: true, rules });
  } catch (error) {
    console.error('Error fetching crosswalk rules:', error);
    return NextResponse.json({ error: 'Failed to fetch rules', details: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { id, jurisdictionId, accountPattern, metricId, signageMultiplier, effectiveStartDate, effectiveEndDate, description } = body;

    if (!jurisdictionId || !accountPattern || !metricId) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const multiplier = signageMultiplier !== undefined ? parseFloat(signageMultiplier) : 1.0;
    const start = effectiveStartDate ? new Date(effectiveStartDate) : new Date('2020-01-01');
    const end = effectiveEndDate ? new Date(effectiveEndDate) : null;

    // Check if updating or creating
    let rule;
    if (id) {
      rule = await prisma.glCrosswalkRule.update({
        where: { id },
        data: {
          accountPattern,
          metricId,
          signageMultiplier: multiplier,
          effectiveStartDate: start,
          effectiveEndDate: end,
          description
        }
      });
    } else {
      rule = await prisma.glCrosswalkRule.create({
        data: {
          jurisdictionId,
          accountPattern,
          metricId,
          signageMultiplier: multiplier,
          effectiveStartDate: start,
          effectiveEndDate: end,
          description
        }
      });
    }

    return NextResponse.json({ success: true, rule });
  } catch (error) {
    console.error('Error saving crosswalk rule:', error);
    return NextResponse.json({ error: 'Failed to save rule', details: error.message }, { status: 500 });
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing rule id' }, { status: 400 });
    }

    await prisma.glCrosswalkRule.delete({
      where: { id }
    });

    return NextResponse.json({ success: true, message: 'Crosswalk rule deleted successfully.' });
  } catch (error) {
    console.error('Error deleting crosswalk rule:', error);
    return NextResponse.json({ error: 'Failed to delete rule', details: error.message }, { status: 500 });
  }
}
