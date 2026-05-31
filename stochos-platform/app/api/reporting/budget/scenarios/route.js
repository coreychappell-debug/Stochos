import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const packageId = searchParams.get('packageId');

    if (!packageId) {
      return NextResponse.json({ error: 'Missing packageId parameter' }, { status: 400 });
    }

    let scenarios = await prisma.budgetScenario.findMany({
      where: { packageId },
      orderBy: { createdAt: 'asc' }
    });

    // Seed a default adopted scenario if none exist
    if (scenarios.length === 0) {
      const defaultScenario = await prisma.budgetScenario.create({
        data: {
          packageId,
          name: 'Base Budget Scenario',
          isAdopted: true,
          status: 'adopted',
          data: {
            '4-1000': 850000000.00, // Sales Budget
            '5-2000': -520000000.00, // Prizes Budget
            '5-2100': -42500000.00 // Commissions Budget (5.00%)
          }
        }
      });
      scenarios = [defaultScenario];
    }

    return NextResponse.json({ success: true, scenarios });
  } catch (error) {
    console.error('Error fetching budget scenarios:', error);
    return NextResponse.json({ error: 'Failed to fetch budget scenarios', details: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { name, packageId, derivedFromScenarioId, data } = body;

    if (!name || !packageId) {
      return NextResponse.json({ error: 'Missing name or packageId parameters' }, { status: 400 });
    }

    let scenarioData = data || {};

    // If derived from another scenario, copy its values as the baseline
    if (derivedFromScenarioId) {
      const parentScenario = await prisma.budgetScenario.findUnique({
        where: { id: derivedFromScenarioId }
      });
      if (parentScenario) {
        scenarioData = { ...parentScenario.data, ...scenarioData };
      }
    }

    const newScenario = await prisma.budgetScenario.create({
      data: {
        packageId,
        name,
        derivedFromScenarioId,
        data: scenarioData,
        status: 'draft',
        isAdopted: false
      }
    });

    return NextResponse.json({ success: true, scenario: newScenario });
  } catch (error) {
    console.error('Error creating budget scenario:', error);
    return NextResponse.json({ error: 'Failed to create budget scenario', details: error.message }, { status: 500 });
  }
}
