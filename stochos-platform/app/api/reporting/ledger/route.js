import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { writeAuditLog } from '@/lib/primitives';
import { evaluateValidationRules } from '@/lib/rulesEngine';

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const jurisdictionId = searchParams.get('jurisdictionId') || '52066ac6-27d4-4495-953b-8f8def2a7851';
    const periodDateStr = searchParams.get('periodDate') || '2024-06-30';
    const page = parseInt(searchParams.get('page') || '1', 10);
    const limit = parseInt(searchParams.get('limit') || '50', 10);
    const search = searchParams.get('search') || '';
    const sortBy = searchParams.get('sortBy') || 'accountCode';
    const sortOrder = searchParams.get('sortOrder') || 'asc';

    const periodDate = new Date(periodDateStr);

    const where = {
      jurisdictionId,
      periodDate,
      ...(search ? {
        OR: [
          { accountCode: { contains: search, mode: 'insensitive' } },
          { accountName: { contains: search, mode: 'insensitive' } }
        ]
      } : {})
    };

    const skip = (page - 1) * limit;

    const [records, totalCount] = await Promise.all([
      prisma.trialBalanceRecord.findMany({
        where,
        orderBy: {
          [sortBy]: sortOrder
        },
        skip,
        take: limit
      }),
      prisma.trialBalanceRecord.count({ where })
    ]);

    const totalPages = Math.ceil(totalCount / limit);

    return NextResponse.json({
      success: true,
      records,
      totalCount,
      totalPages,
      currentPage: page
    });

  } catch (error) {
    console.error('Error fetching ledger records:', error);
    return NextResponse.json(
      { error: 'Failed to fetch ledger records', details: error.message },
      { status: 500 }
    );
  }
}

function getPeriodDetails(date) {
  const month = date.getUTCMonth(); // 0 = Jan, 11 = Dec
  const year = date.getUTCFullYear();
  
  // Fiscal year starts in April (month index 3)
  // If month is Jan, Feb, Mar (0,1,2), fiscal year is the calendar year.
  // If Apr-Dec (3-11), fiscal year is calendar year + 1.
  const fiscalYear = [0, 1, 2].includes(month) ? year : year + 1;
  
  const monthToPeriod = {
    3: 'P01', // April
    4: 'P02', // May
    5: 'P03', // June
    6: 'P04', // July
    7: 'P05', // August
    8: 'P06', // September
    9: 'P07', // October
    10: 'P08', // November
    11: 'P09', // December
    0: 'P10',  // January
    1: 'P11',  // February
    2: 'P12'   // March
  };
  
  const periodCode = monthToPeriod[month] || 'P12';
  return { fiscalYear, periodCode };
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { jurisdictionId, periodDateStr, accountCode, accountName, balance, userId } = body;

    if (!jurisdictionId || !periodDateStr || !accountCode || !accountName || balance === undefined) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const periodDate = new Date(periodDateStr);
    const bal = parseFloat(String(balance)) || 0;
    const { fiscalYear, periodCode } = getPeriodDetails(periodDate);

    // Find user context for audit
    const user = await prisma.user.findFirst({
      where: userId ? { id: userId } : undefined
    }) || await prisma.user.findFirst();

    if (!user) {
      return NextResponse.json({ error: 'User context not found' }, { status: 400 });
    }

    const record = await prisma.trialBalanceRecord.create({
      data: {
        jurisdictionId,
        periodDate,
        fiscalYear,
        periodCode,
        accountCode,
        accountName,
        balance: bal,
        status: 'mapped' // manually mapped adjustment
      }
    });

    // Re-run validation rules for period and save status if a batch exists
    try {
      await evaluateValidationRules(jurisdictionId, periodDate);
    } catch (e) {
      console.error('Failed to run validation rules after manual addition:', e);
    }

    // Write audit log entry
    await writeAuditLog({
      userId: user.id,
      entityType: 'TrialBalanceRecord',
      entityId: record.id,
      action: 'create',
      changes: { accountCode, accountName, balance: bal }
    });

    return NextResponse.json({
      success: true,
      message: 'Ledger record created successfully.',
      record
    });

  } catch (error) {
    console.error('Error creating ledger record:', error);
    return NextResponse.json(
      { error: 'Failed to create ledger record', details: error.message },
      { status: 500 }
    );
  }
}

export async function PUT(request) {
  try {
    const body = await request.json();
    const { id, accountCode, accountName, balance, userId } = body;

    if (!id || !accountCode || !accountName || balance === undefined) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    const bal = parseFloat(String(balance)) || 0;

    // Find user context for audit
    const user = await prisma.user.findFirst({
      where: userId ? { id: userId } : undefined
    }) || await prisma.user.findFirst();

    if (!user) {
      return NextResponse.json({ error: 'User context not found' }, { status: 400 });
    }

    // Fetch existing for audit diff
    const beforeRecord = await prisma.trialBalanceRecord.findUnique({
      where: { id }
    });

    if (!beforeRecord) {
      return NextResponse.json({ error: 'Ledger record not found' }, { status: 404 });
    }

    const record = await prisma.trialBalanceRecord.update({
      where: { id },
      data: {
        accountCode,
        accountName,
        balance: bal
      }
    });

    // Re-run validations
    try {
      await evaluateValidationRules(record.jurisdictionId, record.periodDate);
    } catch (e) {
      console.error('Failed to run validation rules after manual update:', e);
    }

    // Write audit log entry
    await writeAuditLog({
      userId: user.id,
      entityType: 'TrialBalanceRecord',
      entityId: record.id,
      action: 'update',
      changes: {
        before: { accountCode: beforeRecord.accountCode, accountName: beforeRecord.accountName, balance: parseFloat(beforeRecord.balance.toString()) },
        after: { accountCode, accountName, balance: bal }
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Ledger record updated successfully.',
      record
    });

  } catch (error) {
    console.error('Error updating ledger record:', error);
    return NextResponse.json(
      { error: 'Failed to update ledger record', details: error.message },
      { status: 500 }
    );
  }
}

export async function DELETE(request) {
  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    const userId = searchParams.get('userId');

    if (!id) {
      return NextResponse.json({ error: 'Missing record id' }, { status: 400 });
    }

    // Find user context for audit
    const user = await prisma.user.findFirst({
      where: userId ? { id: userId } : undefined
    }) || await prisma.user.findFirst();

    if (!user) {
      return NextResponse.json({ error: 'User context not found' }, { status: 400 });
    }

    // Fetch existing for audit log
    const beforeRecord = await prisma.trialBalanceRecord.findUnique({
      where: { id }
    });

    if (!beforeRecord) {
      return NextResponse.json({ error: 'Ledger record not found' }, { status: 404 });
    }

    await prisma.trialBalanceRecord.delete({
      where: { id }
    });

    // Re-run validations
    try {
      await evaluateValidationRules(beforeRecord.jurisdictionId, beforeRecord.periodDate);
    } catch (e) {
      console.error('Failed to run validation rules after manual deletion:', e);
    }

    // Write audit log entry
    await writeAuditLog({
      userId: user.id,
      entityType: 'TrialBalanceRecord',
      entityId: id,
      action: 'delete',
      changes: { deletedRecord: beforeRecord }
    });

    return NextResponse.json({
      success: true,
      message: 'Ledger record deleted successfully.'
    });

  } catch (error) {
    console.error('Error deleting ledger record:', error);
    return NextResponse.json(
      { error: 'Failed to delete ledger record', details: error.message },
      { status: 500 }
    );
  }
}
