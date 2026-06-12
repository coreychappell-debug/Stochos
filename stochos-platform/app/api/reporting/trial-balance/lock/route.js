import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { writeAuditLog } from '@/lib/primitives';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const jurisdictionId = searchParams.get('jurisdictionId') || 'NY-LOTTERY';
    const fiscalYear = parseInt(searchParams.get('fiscalYear') || '2025', 10);
    const periodCode = searchParams.get('periodCode') || 'P03';

    const lock = await prisma.periodLock.findUnique({
      where: {
        jurisdictionId_fiscalYear_periodCode: {
          jurisdictionId,
          fiscalYear,
          periodCode
        }
      }
    });

    return NextResponse.json({
      success: true,
      isLocked: lock ? lock.isLocked : false,
      lockedAt: lock ? lock.lockedAt : null
    });
  } catch (error) {
    console.error('Error fetching period lock:', error);
    return NextResponse.json({ error: 'Failed to fetch lock status', details: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { jurisdictionId, fiscalYear, periodCode, action, userId } = body;

    if (!jurisdictionId || !fiscalYear || !periodCode || !action) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const fy = parseInt(fiscalYear, 10);
    const user = await prisma.user.findFirst({
      where: userId ? { id: userId } : undefined
    }) || await prisma.user.findFirst();

    if (!user) {
      return NextResponse.json({ error: 'User context not found' }, { status: 400 });
    }

    if (action === 'lock') {
      // 1. Calculate General Ledger sum to verify double-entry balancing
      const aggregate = await prisma.trialBalanceRecord.aggregate({
        where: {
          jurisdictionId,
          fiscalYear: fy,
          periodCode
        },
        _sum: {
          balance: true
        }
      });

      const sum = aggregate._sum.balance ? parseFloat(aggregate._sum.balance.toString()) : 0;
      const roundedSum = Math.round(sum * 100) / 100;

      // Enforce balancing threshold
      if (Math.abs(roundedSum) > 0.01) {
        return NextResponse.json({
          success: false,
          error: `Cannot lock period. General Ledger is out of balance by $${roundedSum.toFixed(2)}. Double-entry accounting requires the sum of all balances to equal $0.00.`
        }, { status: 400 });
      }

      // 2. Lock the period
      const lock = await prisma.periodLock.upsert({
        where: {
          jurisdictionId_fiscalYear_periodCode: {
            jurisdictionId,
            fiscalYear: fy,
            periodCode
          }
        },
        create: {
          jurisdictionId,
          fiscalYear: fy,
          periodCode,
          isLocked: true,
          lockedById: user.id,
          lockedAt: new Date()
        },
        update: {
          isLocked: true,
          lockedById: user.id,
          lockedAt: new Date()
        }
      });

      await writeAuditLog({
        userId: user.id,
        entityType: 'PeriodLock',
        entityId: lock.id,
        action: 'lock',
        changes: { periodCode, fiscalYear: fy }
      });

      return NextResponse.json({
        success: true,
        message: `Period ${periodCode} has been successfully closed and locked.`,
        isLocked: true
      });
    }

    if (action === 'unlock') {
      // Unlock the period
      const lock = await prisma.periodLock.upsert({
        where: {
          jurisdictionId_fiscalYear_periodCode: {
            jurisdictionId,
            fiscalYear: fy,
            periodCode
          }
        },
        create: {
          jurisdictionId,
          fiscalYear: fy,
          periodCode,
          isLocked: false,
          lockedById: null,
          lockedAt: null
        },
        update: {
          isLocked: false,
          lockedById: null,
          lockedAt: null
        }
      });

      await writeAuditLog({
        userId: user.id,
        entityType: 'PeriodLock',
        entityId: lock.id,
        action: 'unlock',
        changes: { periodCode, fiscalYear: fy }
      });

      return NextResponse.json({
        success: true,
        message: `Period ${periodCode} has been unlocked.`,
        isLocked: false
      });
    }

    return NextResponse.json({ error: 'Invalid lock action' }, { status: 400 });

  } catch (error) {
    console.error('Error modifying period lock:', error);
    return NextResponse.json({ error: 'Failed to modify period lock', details: error.message }, { status: 500 });
  }
}
