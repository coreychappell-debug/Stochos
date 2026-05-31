import { NextResponse } from 'next/server';
import { approveCalculation } from '@/lib/metricRegistry';
import { prisma } from '@/lib/db';

export async function POST(request) {
  try {
    const body = await request.json();
    const { calculationId, approvedById } = body;

    if (!calculationId || !approvedById) {
      return NextResponse.json(
        { error: 'Missing required parameters (calculationId, approvedById)' },
        { status: 400 }
      );
    }

    const approvedCalc = await approveCalculation({
      id: calculationId,
      approvedById
    });

    // Write to audit log
    await prisma.auditLog.create({
      data: {
        userId: approvedById,
        entityType: 'MetricCalculation',
        entityId: calculationId,
        action: 'approve',
        changes: { isCurrent: true }
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Calculation version approved and made active.',
      calculation: approvedCalc
    });

  } catch (error) {
    console.error('Error approving metric calculation:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to approve calculation' },
      { status: 400 }
    );
  }
}
