import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { writeAuditLog } from '@/lib/primitives';

// Helper to calculate start and end dates of a fiscal period (assuming July is Month 1 / P01)
function getPeriodDateRange(fiscalYear, periodCode) {
  const periodNum = parseInt(periodCode.replace('P', ''), 10);
  if (isNaN(periodNum)) {
    return null;
  }
  let month = periodNum + 6; // P01 is July (month 7)
  let year = fiscalYear - 1;
  if (month > 12) {
    month -= 12;
    year += 1;
  }
  
  const lastDay = new Date(year, month, 0).getDate();
  const startDate = new Date(Date.UTC(year, month - 1, 1, 0, 0, 0));
  const endDate = new Date(Date.UTC(year, month - 1, lastDay, 23, 59, 59));
  return { startDate, endDate };
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const jurisdictionId = searchParams.get('jurisdictionId') || 'NY-LOTTERY';
    const fiscalYear = parseInt(searchParams.get('fiscalYear') || '2025', 10);
    const periodCode = searchParams.get('periodCode') || 'P03';

    // 1. Get checklist items from DB (Terminal Sales, Treasury Reconcile)
    const checklistItems = await prisma.periodCloseChecklistItem.findMany({
      where: {
        jurisdictionId,
        fiscalYear,
        periodCode
      },
      include: {
        completedBy: {
          select: {
            name: true,
            email: true
          }
        }
      }
    });

    // 2. Query dynamic GL Ingestion state
    const tbCount = await prisma.trialBalanceRecord.count({
      where: {
        jurisdictionId,
        fiscalYear,
        periodCode
      }
    });

    const tbAggregate = await prisma.trialBalanceRecord.aggregate({
      where: {
        jurisdictionId,
        fiscalYear,
        periodCode
      },
      _sum: {
        balance: true
      }
    });
    const glSum = tbAggregate._sum.balance ? parseFloat(tbAggregate._sum.balance.toString()) : 0;
    const isGlBalanced = Math.abs(glSum) <= 0.01;

    // 3. Query dynamic Commentary Task state
    const dateRange = getPeriodDateRange(fiscalYear, periodCode);
    let pendingCommentariesCount = 0;
    let totalCommentariesCount = 0;

    if (dateRange) {
      const packages = await prisma.reportPackage.findMany({
        where: {
          jurisdictionId,
          periodDate: {
            gte: dateRange.startDate,
            lte: dateRange.endDate
          }
        },
        include: {
          commentaryTasks: true
        }
      });

      packages.forEach(pkg => {
        pkg.commentaryTasks.forEach(task => {
          totalCommentariesCount++;
          if (task.status === 'pending') {
            pendingCommentariesCount++;
          }
        });
      });
    }

    // 4. Query period lock status
    const periodLock = await prisma.periodLock.findUnique({
      where: {
        jurisdictionId_fiscalYear_periodCode: {
          jurisdictionId,
          fiscalYear,
          periodCode
        }
      },
      include: {
        lockedBy: {
          select: {
            name: true
          }
        }
      }
    });

    // 5. Query simulation users
    const simulationUsers = await prisma.user.findMany({
      where: {
        email: {
          in: [
            'robert.williams@gaming.ny.gov',
            'finance.user@gaming.ny.gov',
            'ops.user@gaming.ny.gov',
            'marketing.user@gaming.ny.gov'
          ]
        }
      },
      select: {
        id: true,
        name: true,
        email: true,
        division: true
      }
    });

    // Combine static completion states with dynamic items
    const defaultKeys = ['TERMINAL_SALES', 'PRIZE_RECONCILIATION'];
    const staticTasks = defaultKeys.map(key => {
      const dbItem = checklistItems.find(item => item.taskKey === key);
      return {
        taskKey: key,
        isCompleted: dbItem ? dbItem.isCompleted : false,
        completedBy: dbItem?.completedBy?.name || null,
        completedAt: dbItem?.completedAt || null
      };
    });

    const tasks = [
      ...staticTasks,
      {
        taskKey: 'GL_INGESTION',
        isCompleted: tbCount > 0,
        recordCount: tbCount,
        isBalanced: isGlBalanced,
        balanceOverage: glSum,
        completedBy: tbCount > 0 ? 'System Automator' : null,
        completedAt: null
      },
      {
        taskKey: 'VARIANCE_COMMENTARY',
        isCompleted: totalCommentariesCount === 0 || pendingCommentariesCount === 0,
        pendingCount: pendingCommentariesCount,
        totalCount: totalCommentariesCount,
        completedBy: (totalCommentariesCount === 0 || pendingCommentariesCount === 0) ? 'System Automator' : null,
        completedAt: null
      }
    ];

    return NextResponse.json({
      success: true,
      tasks,
      isLocked: periodLock ? periodLock.isLocked : false,
      lockedBy: periodLock?.lockedBy?.name || null,
      lockedAt: periodLock?.lockedAt || null,
      simulationUsers
    });

  } catch (error) {
    console.error('Error fetching close checklist status:', error);
    return NextResponse.json({ error: 'Failed to fetch close checklist status', details: error.message }, { status: 500 });
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const { jurisdictionId, fiscalYear, periodCode, taskKey, isCompleted, userId } = body;

    if (!jurisdictionId || !fiscalYear || !periodCode || !taskKey) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const fy = parseInt(fiscalYear, 10);

    // 1. Check if period is locked
    const lock = await prisma.periodLock.findUnique({
      where: {
        jurisdictionId_fiscalYear_periodCode: {
          jurisdictionId,
          fiscalYear: fy,
          periodCode
        }
      }
    });

    if (lock && lock.isLocked) {
      return NextResponse.json({ error: 'Cannot update checklist. This period is locked.' }, { status: 400 });
    }

    // 2. Resolve User Context
    const user = await prisma.user.findFirst({
      where: userId ? { id: userId } : undefined
    }) || await prisma.user.findFirst();

    if (!user) {
      return NextResponse.json({ error: 'User context not found' }, { status: 400 });
    }

    // 3. Upsert close checklist item status
    const checklistItem = await prisma.periodCloseChecklistItem.upsert({
      where: {
        jurisdictionId_fiscalYear_periodCode_taskKey: {
          jurisdictionId,
          fiscalYear: fy,
          periodCode,
          taskKey
        }
      },
      create: {
        jurisdictionId,
        fiscalYear: fy,
        periodCode,
        taskKey,
        isCompleted,
        completedById: isCompleted ? user.id : null,
        completedAt: isCompleted ? new Date() : null
      },
      update: {
        isCompleted,
        completedById: isCompleted ? user.id : null,
        completedAt: isCompleted ? new Date() : null
      }
    });

    // Write audit log
    await writeAuditLog({
      userId: user.id,
      entityType: 'PeriodCloseChecklistItem',
      entityId: checklistItem.id,
      action: isCompleted ? 'complete_task' : 'revert_task',
      changes: { taskKey, periodCode, fiscalYear: fy }
    });

    return NextResponse.json({
      success: true,
      checklistItem
    });

  } catch (error) {
    console.error('Error updating close checklist item:', error);
    return NextResponse.json({ error: 'Failed to update close checklist item', details: error.message }, { status: 500 });
  }
}
