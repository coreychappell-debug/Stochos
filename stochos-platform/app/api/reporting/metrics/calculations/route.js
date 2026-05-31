import { NextResponse } from 'next/server';
import { upsertMetricCalculation } from '@/lib/metricRegistry';
import { prisma } from '@/lib/db';

export async function POST(request) {
  try {
    const body = await request.json();
    const {
      metricDefinitionId,
      version,
      expression,
      aggregationBehavior,
      dependencyMetrics,
      effectiveStartDate,
      effectiveEndDate,
      createdById
    } = body;

    if (!metricDefinitionId || !version || !expression) {
      return NextResponse.json(
        { error: 'Missing required fields (metricDefinitionId, version, expression)' },
        { status: 400 }
      );
    }

    // Default to first user if none provided
    let creatorId = createdById;
    if (!creatorId) {
      const firstUser = await prisma.user.findFirst();
      if (!firstUser) {
        return NextResponse.json({ error: 'No user available to create calculation' }, { status: 400 });
      }
      creatorId = firstUser.id;
    }

    const calculation = await upsertMetricCalculation({
      metricDefinitionId,
      version: parseInt(version, 10),
      expression,
      aggregationBehavior: aggregationBehavior || null,
      dependencyMetrics: dependencyMetrics || [],
      effectiveStartDate: effectiveStartDate ? new Date(effectiveStartDate) : new Date(),
      effectiveEndDate: effectiveEndDate ? new Date(effectiveEndDate) : null,
      createdById: creatorId
    });

    return NextResponse.json({
      success: true,
      message: 'Calculation version saved successfully.',
      calculation
    });

  } catch (error) {
    console.error('Error saving metric calculation:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to save calculation version' },
      { status: 400 }
    );
  }
}
