import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import fs from 'fs';
import path from 'path';

const OVERRIDES_FILE = path.join(process.cwd(), 'data', 'grid_overrides.json');

// Helper to ensure data directory and file exist
function getOverrides() {
  try {
    const dir = path.dirname(OVERRIDES_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(OVERRIDES_FILE)) {
      fs.writeFileSync(OVERRIDES_FILE, JSON.stringify({ cellFormats: {}, columnFormats: {} }));
    }
    return JSON.parse(fs.readFileSync(OVERRIDES_FILE, 'utf-8'));
  } catch (error) {
    console.error("Failed to read overrides file:", error);
    return { cellFormats: {}, columnFormats: {} };
  }
}

function saveOverrides(data) {
  try {
    const dir = path.dirname(OVERRIDES_FILE);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(OVERRIDES_FILE, JSON.stringify(data, null, 2));
  } catch (error) {
    console.error("Failed to write overrides file:", error);
  }
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const jurisdictionId = searchParams.get('jurisdictionId') || '52066ac6-27d4-4495-953b-8f8def2a7851'; // Default to New York Lottery seed
    const periodDateStr = searchParams.get('periodDate') || '2024-06-30';
    const periodDate = new Date(periodDateStr);

    // 1. Fetch Trial Balance values from database
    const records = await prisma.trialBalanceRecord.findMany({
      where: {
        jurisdictionId,
        periodDate
      }
    });

    // 2. Sum balances by account code
    const actuals = {
      '4-1000': 0, // Gross Ticket Sales
      '5-2000': 0, // Prize Expense
      '5-2100': 0  // Retailer Commissions
    };

    for (const r of records) {
      if (actuals[r.accountCode] !== undefined) {
        actuals[r.accountCode] += parseFloat(r.balance.toString());
      }
    }

    // 3. Load formatting overrides from file store
    const overrides = getOverrides();

    return NextResponse.json({
      success: true,
      actuals,
      cellFormats: overrides.cellFormats || {},
      columnFormats: overrides.columnFormats || {
        'col_actuals_2024': { scale: 'millions', currency_symbol: '$', decimal_places: 1, negative_style: 'parentheses', zero_display: 'dash' },
        'col_actuals_2023': { scale: 'millions', currency_symbol: '$', decimal_places: 1, negative_style: 'parentheses', zero_display: 'dash' },
        'col_variance': { scale: 'millions', currency_symbol: '$', decimal_places: 1, negative_style: 'parentheses', zero_display: 'dash' }
      }
    });
  } catch (error) {
    console.error('Error fetching grid data:', error);
    return NextResponse.json({ error: 'Failed to fetch grid data', details: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { type, id, format, userId } = body; // type is 'cell' or 'column'

    if (!type || !id || !format) {
      return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
    }

    // Find a valid admin/user to record in audit log
    let user = await prisma.user.findFirst({
      where: userId ? { id: userId } : undefined
    });
    if (!user) {
      user = await prisma.user.findFirst();
    }

    if (!user) {
      return NextResponse.json({ error: 'No user context found for audit logging' }, { status: 400 });
    }

    const overrides = getOverrides();
    let prevFormat = null;

    if (type === 'cell') {
      prevFormat = overrides.cellFormats[id] || null;
      overrides.cellFormats[id] = format;
    } else if (type === 'column') {
      prevFormat = overrides.columnFormats[id] || null;
      overrides.columnFormats[id] = format;
    }

    saveOverrides(overrides);

    // Write audit trail entry in database
    await prisma.formatAuditEntry.create({
      data: {
        entityType: type,
        entityId: id,
        changedById: user.id,
        previousFormat: prevFormat || undefined,
        newFormat: format,
        reason: `Format configuration saved via Governed Grid`,
        source: 'manual'
      }
    });

    return NextResponse.json({
      success: true,
      message: 'Format settings updated and logged successfully.'
    });

  } catch (error) {
    console.error('Error saving format override:', error);
    return NextResponse.json({ error: 'Failed to update format override', details: error.message }, { status: 500 });
  }
}
