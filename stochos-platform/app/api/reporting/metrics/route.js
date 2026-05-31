import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request) {
  try {
    const metrics = await prisma.metricDefinition.findMany({
      include: {
        calculations: {
          orderBy: { version: 'desc' }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    return NextResponse.json({ success: true, metrics });
  } catch (error) {
    console.error('Error fetching metric definitions:', error);
    return NextResponse.json({ error: 'Failed to fetch metrics', details: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { name, glAccount, dimensions, ownerUserId, effectiveStartDate, effectiveEndDate, numberFormat } = body;

    if (!name) {
      return NextResponse.json({ error: 'Metric name is required' }, { status: 400 });
    }

    const metric = await prisma.metricDefinition.create({
      data: {
        name,
        glAccount: glAccount || null,
        dimensions: dimensions || null,
        ownerUserId: ownerUserId || 'system',
        effectiveStartDate: effectiveStartDate ? new Date(effectiveStartDate) : new Date(),
        effectiveEndDate: effectiveEndDate ? new Date(effectiveEndDate) : null,
        numberFormat: numberFormat || null,
      }
    });

    return NextResponse.json({ success: true, metric });
  } catch (error) {
    console.error('Error creating metric definition:', error);
    return NextResponse.json({ error: 'Failed to create metric', details: error.message }, { status: 500 });
  }
}
