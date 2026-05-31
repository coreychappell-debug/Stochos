import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function POST(request, { params }) {
  try {
    const { id } = await params;

    const targetScenario = await prisma.budgetScenario.findUnique({
      where: { id }
    });

    if (!targetScenario) {
      return NextResponse.json({ error: 'Budget scenario not found' }, { status: 404 });
    }

    // Set target scenario to adopted and clear other scenarios in the same package
    const updated = await prisma.$transaction(async (tx) => {
      // Clear adopted status of other scenarios in this package
      await tx.budgetScenario.updateMany({
        where: {
          packageId: targetScenario.packageId,
          id: { not: id }
        },
        data: {
          isAdopted: false,
          status: 'active'
        }
      });

      // Mark target scenario as adopted
      return tx.budgetScenario.update({
        where: { id },
        data: {
          isAdopted: true,
          status: 'adopted'
        }
      });
    });

    return NextResponse.json({ success: true, scenario: updated });
  } catch (error) {
    console.error('Error adopting budget scenario:', error);
    return NextResponse.json({ error: 'Failed to adopt budget scenario', details: error.message }, { status: 500 });
  }
}
