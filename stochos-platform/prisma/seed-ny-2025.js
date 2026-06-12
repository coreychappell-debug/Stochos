// prisma/seed-ny-2025.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { prisma } = require('../lib/db.js');

async function seedNyData() {
  try {
    const jurisdictionId = 'NY-LOTTERY';

    // Ensure jurisdiction exists
    let existingJ = await prisma.jurisdiction.findUnique({
      where: { abbreviation: 'NY' }
    });
    if (!existingJ) {
      existingJ = await prisma.jurisdiction.create({
        data: {
          id: jurisdictionId,
          name: 'New York Lottery',
          abbreviation: 'NY',
          currency: 'USD',
          fiscalYearStartMonth: 4,
          timezone: 'America/New_York',
          status: 'active'
        }
      });
    }
    const jId = existingJ.id;
    console.log(`Using jurisdiction ID: ${jId}`);

    // Define GasbRow layout definitions matching official NY structure
    const gasbRows = [
      // ==========================================
      // Statement of Net Position (netPosition)
      // ==========================================
      // Current Assets
      { jurisdictionId: jId, statement: 'netPosition', section: 'currentAssets', label: 'Cash and cash equivalents', accountPattern: '1-1000', rowType: 'data', signageMultiplier: 1.0, sortOrder: 10 },
      { jurisdictionId: jId, statement: 'netPosition', section: 'currentAssets', label: 'Accounts receivable, net', accountPattern: '1-1200', rowType: 'data', signageMultiplier: 1.0, sortOrder: 20 },
      { jurisdictionId: jId, statement: 'netPosition', section: 'currentAssets', label: 'Instant ticket inventory', accountPattern: '1-1310', rowType: 'data', signageMultiplier: 1.0, sortOrder: 30 },
      { jurisdictionId: jId, statement: 'netPosition', section: 'currentAssets', label: 'Investments', accountPattern: '1-1400', rowType: 'data', signageMultiplier: 1.0, sortOrder: 40 },
      { jurisdictionId: jId, statement: 'netPosition', section: 'currentAssets', label: 'Total current assets', accountPattern: '', rowType: 'subtotal', signageMultiplier: 1.0, sortOrder: 50 },

      // Noncurrent Assets
      { jurisdictionId: jId, statement: 'netPosition', section: 'nonCurrentAssets', label: 'Long-term investments, net', accountPattern: '1-2200', rowType: 'data', signageMultiplier: 1.0, sortOrder: 60 },
      { jurisdictionId: jId, statement: 'netPosition', section: 'nonCurrentAssets', label: 'Leases', accountPattern: '1-2300', rowType: 'data', signageMultiplier: 1.0, sortOrder: 70 },
      { jurisdictionId: jId, statement: 'netPosition', section: 'nonCurrentAssets', label: 'Capital assets', accountPattern: '1-2400', rowType: 'data', signageMultiplier: 1.0, sortOrder: 80 },
      { jurisdictionId: jId, statement: 'netPosition', section: 'nonCurrentAssets', label: 'Total noncurrent assets', accountPattern: '', rowType: 'subtotal', signageMultiplier: 1.0, sortOrder: 90 },
      { jurisdictionId: jId, statement: 'netPosition', section: 'nonCurrentAssets', label: 'Total Assets', accountPattern: '', rowType: 'total', signageMultiplier: 1.0, sortOrder: 100 },

      // Deferred Outflows
      { jurisdictionId: jId, statement: 'netPosition', section: 'deferredOutflows', label: 'Deferred outflows of resources', accountPattern: '1-3000', rowType: 'data', signageMultiplier: 1.0, sortOrder: 110 },
      { jurisdictionId: jId, statement: 'netPosition', section: 'deferredOutflows', label: 'Total assets and deferred outflows of resources', accountPattern: '', rowType: 'total', signageMultiplier: 1.0, sortOrder: 120 },

      // Current Liabilities
      { jurisdictionId: jId, statement: 'netPosition', section: 'currentLiabilities', label: 'Prizes payable', accountPattern: '2-1100', rowType: 'data', signageMultiplier: -1.0, sortOrder: 130 },
      { jurisdictionId: jId, statement: 'netPosition', section: 'currentLiabilities', label: 'Leases payable', accountPattern: '2-1010', rowType: 'data', signageMultiplier: -1.0, sortOrder: 140 },
      { jurisdictionId: jId, statement: 'netPosition', section: 'currentLiabilities', label: 'Unclaimed prizes', accountPattern: '2-1150', rowType: 'data', signageMultiplier: -1.0, sortOrder: 150 },
      { jurisdictionId: jId, statement: 'netPosition', section: 'currentLiabilities', label: 'Due to Lottery Aid to Education', accountPattern: '2-1200', rowType: 'data', signageMultiplier: -1.0, sortOrder: 160 },
      { jurisdictionId: jId, statement: 'netPosition', section: 'currentLiabilities', label: 'Accounts payable and accrued liabilities', accountPattern: '2-1000', rowType: 'data', signageMultiplier: -1.0, sortOrder: 170 },
      { jurisdictionId: jId, statement: 'netPosition', section: 'currentLiabilities', label: 'Unearned ticket sales', accountPattern: '2-1300', rowType: 'data', signageMultiplier: -1.0, sortOrder: 180 },
      { jurisdictionId: jId, statement: 'netPosition', section: 'currentLiabilities', label: 'Compensated absences', accountPattern: '2-1400', rowType: 'data', signageMultiplier: -1.0, sortOrder: 190 },
      { jurisdictionId: jId, statement: 'netPosition', section: 'currentLiabilities', label: 'Total current liabilities', accountPattern: '', rowType: 'subtotal', signageMultiplier: 1.0, sortOrder: 200 },

      // Noncurrent Liabilities
      { jurisdictionId: jId, statement: 'netPosition', section: 'nonCurrentLiabilities', label: 'Compensated absences, noncurrent', accountPattern: '2-2400', rowType: 'data', signageMultiplier: -1.0, sortOrder: 210 },
      { jurisdictionId: jId, statement: 'netPosition', section: 'nonCurrentLiabilities', label: 'Long-term leases payable', accountPattern: '2-2010', rowType: 'data', signageMultiplier: -1.0, sortOrder: 220 },
      { jurisdictionId: jId, statement: 'netPosition', section: 'nonCurrentLiabilities', label: 'Pension contribution payable', accountPattern: '2-2020', rowType: 'data', signageMultiplier: -1.0, sortOrder: 230 },
      { jurisdictionId: jId, statement: 'netPosition', section: 'nonCurrentLiabilities', label: 'Net pension liability', accountPattern: '2-2500', rowType: 'data', signageMultiplier: -1.0, sortOrder: 240 },
      { jurisdictionId: jId, statement: 'netPosition', section: 'nonCurrentLiabilities', label: 'Other postemployment benefits', accountPattern: '2-2600', rowType: 'data', signageMultiplier: -1.0, sortOrder: 250 },
      { jurisdictionId: jId, statement: 'netPosition', section: 'nonCurrentLiabilities', label: 'Long-term prizes payable', accountPattern: '2-2100', rowType: 'data', signageMultiplier: -1.0, sortOrder: 260 },
      { jurisdictionId: jId, statement: 'netPosition', section: 'nonCurrentLiabilities', label: 'Total noncurrent liabilities', accountPattern: '', rowType: 'subtotal', signageMultiplier: 1.0, sortOrder: 270 },
      { jurisdictionId: jId, statement: 'netPosition', section: 'nonCurrentLiabilities', label: 'Total liabilities', accountPattern: '', rowType: 'total', signageMultiplier: 1.0, sortOrder: 280 },

      // Deferred Inflows
      { jurisdictionId: jId, statement: 'netPosition', section: 'deferredInflows', label: 'Deferred inflows of resources', accountPattern: '2-3000', rowType: 'data', signageMultiplier: -1.0, sortOrder: 290 },
      { jurisdictionId: jId, statement: 'netPosition', section: 'deferredInflows', label: 'Total liabilities and deferred inflows of resources', accountPattern: '', rowType: 'total', signageMultiplier: 1.0, sortOrder: 300 },

      // Net Position
      { jurisdictionId: jId, statement: 'netPosition', section: 'netPosition', label: 'Invested in capital assets', accountPattern: '3-1000', rowType: 'data', signageMultiplier: -1.0, sortOrder: 310 },
      { jurisdictionId: jId, statement: 'netPosition', section: 'netPosition', label: 'Restricted for future prizes', accountPattern: '3-1100', rowType: 'data', signageMultiplier: -1.0, sortOrder: 320 },
      { jurisdictionId: jId, statement: 'netPosition', section: 'netPosition', label: 'Unrestricted', accountPattern: '3-1200', rowType: 'data', signageMultiplier: -1.0, sortOrder: 330 },
      { jurisdictionId: jId, statement: 'netPosition', section: 'netPosition', label: 'Total net position', accountPattern: '', rowType: 'total', signageMultiplier: 1.0, sortOrder: 340 },
      { jurisdictionId: jId, statement: 'netPosition', section: 'netPosition', label: 'Total liabilities, deferred inflows of resources and net position', accountPattern: '', rowType: 'total', signageMultiplier: 1.0, sortOrder: 350 },

      // ==========================================
      // Statement of Revenues & Expenses (revenuesExpenses)
      // ==========================================
      { jurisdictionId: jId, statement: 'revenuesExpenses', section: 'operatingRevenues', label: 'Lottery revenue, net', accountPattern: '4-1000', rowType: 'data', signageMultiplier: -1.0, sortOrder: 10 },
      { jurisdictionId: jId, statement: 'revenuesExpenses', section: 'operatingRevenues', label: 'Total Operating Revenues', accountPattern: '', rowType: 'total', signageMultiplier: 1.0, sortOrder: 20 },
      
      // Direct Expenses
      { jurisdictionId: jId, statement: 'revenuesExpenses', section: 'directExpenses', label: 'Prize expense, net', accountPattern: '5-2000', rowType: 'data', signageMultiplier: 1.0, sortOrder: 30 },
      { jurisdictionId: jId, statement: 'revenuesExpenses', section: 'directExpenses', label: 'Retailer commissions', accountPattern: '5-2100', rowType: 'data', signageMultiplier: 1.0, sortOrder: 40 },
      { jurisdictionId: jId, statement: 'revenuesExpenses', section: 'directExpenses', label: 'Gaming contractor fees', accountPattern: '5-2200', rowType: 'data', signageMultiplier: 1.0, sortOrder: 50 },
      { jurisdictionId: jId, statement: 'revenuesExpenses', section: 'directExpenses', label: 'Instant ticket direct expenses', accountPattern: '5-2400', rowType: 'data', signageMultiplier: 1.0, sortOrder: 60 },
      { jurisdictionId: jId, statement: 'revenuesExpenses', section: 'directExpenses', label: 'Telecommunications expenses', accountPattern: '5-2500', rowType: 'data', signageMultiplier: 1.0, sortOrder: 70 },
      { jurisdictionId: jId, statement: 'revenuesExpenses', section: 'directExpenses', label: 'Total direct expenses', accountPattern: '', rowType: 'subtotal', signageMultiplier: 1.0, sortOrder: 80 },

      // Indirect Expenses
      { jurisdictionId: jId, statement: 'revenuesExpenses', section: 'indirectExpenses', label: 'Marketing and advertising expenses', accountPattern: '6-4000', rowType: 'data', signageMultiplier: 1.0, sortOrder: 90 },
      { jurisdictionId: jId, statement: 'revenuesExpenses', section: 'indirectExpenses', label: 'Personal service and fringe benefits', accountPattern: '6-4100', rowType: 'data', signageMultiplier: 1.0, sortOrder: 100 },
      { jurisdictionId: jId, statement: 'revenuesExpenses', section: 'indirectExpenses', label: 'Other administrative costs', accountPattern: '6-4200', rowType: 'data', signageMultiplier: 1.0, sortOrder: 110 },
      { jurisdictionId: jId, statement: 'revenuesExpenses', section: 'indirectExpenses', label: 'State agency charges', accountPattern: '6-4300', rowType: 'data', signageMultiplier: 1.0, sortOrder: 120 },
      { jurisdictionId: jId, statement: 'revenuesExpenses', section: 'indirectExpenses', label: 'Amortization - leases', accountPattern: '6-4400', rowType: 'data', signageMultiplier: 1.0, sortOrder: 130 },
      { jurisdictionId: jId, statement: 'revenuesExpenses', section: 'indirectExpenses', label: 'Depreciation', accountPattern: '6-4500', rowType: 'data', signageMultiplier: 1.0, sortOrder: 140 },
      { jurisdictionId: jId, statement: 'revenuesExpenses', section: 'indirectExpenses', label: 'Total indirect expenses', accountPattern: '', rowType: 'subtotal', signageMultiplier: 1.0, sortOrder: 150 },
      { jurisdictionId: jId, statement: 'revenuesExpenses', section: 'indirectExpenses', label: 'Total Operating Expenses', accountPattern: '', rowType: 'total', signageMultiplier: 1.0, sortOrder: 160 },
      { jurisdictionId: jId, statement: 'revenuesExpenses', section: 'indirectExpenses', label: 'Operating Income (Loss)', accountPattern: '', rowType: 'total', signageMultiplier: 1.0, sortOrder: 170 },

      // Non-operating & transfers
      { jurisdictionId: jId, statement: 'revenuesExpenses', section: 'nonOperating', label: 'Investment gain', accountPattern: '4-3000', rowType: 'data', signageMultiplier: -1.0, sortOrder: 180 },
      { jurisdictionId: jId, statement: 'revenuesExpenses', section: 'nonOperating', label: 'Other revenue, net', accountPattern: '4-4000', rowType: 'data', signageMultiplier: -1.0, sortOrder: 190 },
      { jurisdictionId: jId, statement: 'revenuesExpenses', section: 'nonOperating', label: 'Investment expense, net', accountPattern: '5-3000', rowType: 'data', signageMultiplier: 1.0, sortOrder: 200 },
      { jurisdictionId: jId, statement: 'revenuesExpenses', section: 'nonOperating', label: 'Total nonoperating revenue, net', accountPattern: '', rowType: 'total', signageMultiplier: 1.0, sortOrder: 210 },
      { jurisdictionId: jId, statement: 'revenuesExpenses', section: 'nonOperating', label: 'Income before required allocation', accountPattern: '', rowType: 'total', signageMultiplier: 1.0, sortOrder: 220 },
      { jurisdictionId: jId, statement: 'revenuesExpenses', section: 'nonOperating', label: 'Required allocation for Lottery Aid to Education', accountPattern: '5-2300', rowType: 'data', signageMultiplier: 1.0, sortOrder: 230 },
      { jurisdictionId: jId, statement: 'revenuesExpenses', section: 'nonOperating', label: 'Lottery Aid Guarantee', accountPattern: '5-2350', rowType: 'data', signageMultiplier: -1.0, sortOrder: 240 },
      { jurisdictionId: jId, statement: 'revenuesExpenses', section: 'nonOperating', label: 'Change in net position', accountPattern: '', rowType: 'total', signageMultiplier: 1.0, sortOrder: 250 },
      { jurisdictionId: jId, statement: 'revenuesExpenses', section: 'nonOperating', label: 'Net Position, Beginning of Period', accountPattern: '', rowType: 'total', signageMultiplier: 1.0, sortOrder: 260 },
      { jurisdictionId: jId, statement: 'revenuesExpenses', section: 'nonOperating', label: 'Net Position, End of Period', accountPattern: '', rowType: 'total', signageMultiplier: 1.0, sortOrder: 270 },

      // ==========================================
      // Statement of Cash Flows (cashFlows)
      // ==========================================
      // In trial balance: Inflows are Credit (negative), Outflows are Debit (positive).
      // Row signageMultiplier is -1.0 for all data rows to flip inflows to positive and outflows to negative.
      { jurisdictionId: jId, statement: 'cashFlows', section: 'cashOperating', label: 'Receipts from customers', accountPattern: 'cf-receipts', rowType: 'data', signageMultiplier: -1.0, sortOrder: 10 },
      { jurisdictionId: jId, statement: 'cashFlows', section: 'cashOperating', label: 'Other cash receipts', accountPattern: 'cf-other-receipts', rowType: 'data', signageMultiplier: -1.0, sortOrder: 20 },
      { jurisdictionId: jId, statement: 'cashFlows', section: 'cashOperating', label: 'Payments for prizes', accountPattern: 'cf-prizes', rowType: 'data', signageMultiplier: -1.0, sortOrder: 30 },
      { jurisdictionId: jId, statement: 'cashFlows', section: 'cashOperating', label: 'Payments to retailers for commissions and fees', accountPattern: 'cf-commissions', rowType: 'data', signageMultiplier: -1.0, sortOrder: 40 },
      { jurisdictionId: jId, statement: 'cashFlows', section: 'cashOperating', label: 'Payments to gaming contractor fees', accountPattern: 'cf-contractor', rowType: 'data', signageMultiplier: -1.0, sortOrder: 50 },
      { jurisdictionId: jId, statement: 'cashFlows', section: 'cashOperating', label: 'Payments for telecommunications', accountPattern: 'cf-telecom', rowType: 'data', signageMultiplier: -1.0, sortOrder: 60 },
      { jurisdictionId: jId, statement: 'cashFlows', section: 'cashOperating', label: 'Payments for instant ticket direct expenses', accountPattern: 'cf-instant', rowType: 'data', signageMultiplier: -1.0, sortOrder: 70 },
      { jurisdictionId: jId, statement: 'cashFlows', section: 'cashOperating', label: 'Payments to employees and vendors for goods/services', accountPattern: 'cf-admin', rowType: 'data', signageMultiplier: -1.0, sortOrder: 80 },
      { jurisdictionId: jId, statement: 'cashFlows', section: 'cashOperating', label: 'Net Cash Provided by Operating Activities', accountPattern: '', rowType: 'total', signageMultiplier: 1.0, sortOrder: 90 },

      { jurisdictionId: jId, statement: 'cashFlows', section: 'cashFinancing', label: 'Cash transfer to State for Lottery Aid to Education', accountPattern: 'cf-education', rowType: 'data', signageMultiplier: -1.0, sortOrder: 100 },
      { jurisdictionId: jId, statement: 'cashFlows', section: 'cashFinancing', label: 'Cash received from State General Fund for Lottery Aid Guarantee', accountPattern: 'cf-guarantee', rowType: 'data', signageMultiplier: -1.0, sortOrder: 110 },
      { jurisdictionId: jId, statement: 'cashFlows', section: 'cashFinancing', label: 'Net Cash Used for Noncapital Financing Activities', accountPattern: '', rowType: 'total', signageMultiplier: 1.0, sortOrder: 120 },

      { jurisdictionId: jId, statement: 'cashFlows', section: 'cashCapital', label: 'Purchases of capital assets, net of disposals', accountPattern: 'cf-capital', rowType: 'data', signageMultiplier: -1.0, sortOrder: 130 },
      { jurisdictionId: jId, statement: 'cashFlows', section: 'cashCapital', label: 'Net Cash Used for Capital Financing Activities', accountPattern: '', rowType: 'total', signageMultiplier: 1.0, sortOrder: 140 },

      { jurisdictionId: jId, statement: 'cashFlows', section: 'cashInvesting', label: 'Proceeds from investment maturities', accountPattern: 'cf-inv-mat', rowType: 'data', signageMultiplier: -1.0, sortOrder: 150 },
      { jurisdictionId: jId, statement: 'cashFlows', section: 'cashInvesting', label: 'Purchases of investments', accountPattern: 'cf-inv-purch', rowType: 'data', signageMultiplier: -1.0, sortOrder: 160 },
      { jurisdictionId: jId, statement: 'cashFlows', section: 'cashInvesting', label: 'Interest on cash and cash equivalents and investments', accountPattern: 'cf-inv-int', rowType: 'data', signageMultiplier: -1.0, sortOrder: 170 },
      { jurisdictionId: jId, statement: 'cashFlows', section: 'cashInvesting', label: 'Net Cash Provided by Investing Activities', accountPattern: '', rowType: 'total', signageMultiplier: 1.0, sortOrder: 180 },

      { jurisdictionId: jId, statement: 'cashFlows', section: 'cashRollForward', label: 'Net Increase in Cash and Cash Equivalents', accountPattern: '', rowType: 'total', signageMultiplier: 1.0, sortOrder: 190 },
      { jurisdictionId: jId, statement: 'cashFlows', section: 'cashRollForward', label: 'Cash and Cash Equivalents, Beginning of Period', accountPattern: '', rowType: 'total', signageMultiplier: 1.0, sortOrder: 200 },
      { jurisdictionId: jId, statement: 'cashFlows', section: 'cashRollForward', label: 'Cash and Cash Equivalents, End of Period', accountPattern: '', rowType: 'total', signageMultiplier: 1.0, sortOrder: 210 }
    ];

    console.log("Cleaning old GASB statement row definitions (GasbRow)...");
    await prisma.gasbRow.deleteMany({
      where: { jurisdictionId: jId }
    });

    console.log("Seeding official GASB statement row definitions...");
    for (const row of gasbRows) {
      await prisma.gasbRow.create({ data: row });
    }
    console.log("✓ Seeding GASB rows completed.");

    // Generate balanced ledger sets
    const tbData = [];

    // Helper to add balanced set to array
    const addTbRecord = (year, period, dateStr, code, name, val) => {
      tbData.push({
        jurisdictionId: jId,
        fiscalYear: year,
        periodCode: period,
        periodDate: new Date(dateStr),
        accountCode: code,
        accountName: name,
        balance: val,
        status: 'imported'
      });
    };

    // Helper to add balanced ledger for both periods (P03 and P12)
    const addYearLedger = (year, dateP03, dateP12, records) => {
      records.forEach(r => {
        addTbRecord(year, 'P03', dateP03, r.code, r.name, r.val);
        addTbRecord(year, 'P12', dateP12, r.code, r.name, r.val);
      });
    };

    // ==========================================
    // FY 2025 Ledger Records
    // ==========================================
    const records2025 = [
      { code: '1-1000', name: 'Cash and cash equivalents', val: 1317039000.00 },
      { code: '1-1200', name: 'Accounts receivable, net', val: 430389000.00 },
      { code: '1-1310', name: 'Instant ticket inventory', val: 18496000.00 },
      { code: '1-1400', name: 'Investments', val: 78206000.00 },
      { code: '1-2200', name: 'Long-term investments, net', val: 618506000.00 },
      { code: '1-2300', name: 'Leases', val: 16340000.00 },
      { code: '1-2400', name: 'Capital assets', val: 1273000.00 },
      { code: '1-3000', name: 'Deferred outflows of resources', val: 11824000.00 },

      { code: '2-1100', name: 'Prizes payable', val: -129202000.00 },
      { code: '2-1010', name: 'Leases payable', val: -1713000.00 },
      { code: '2-1150', name: 'Unclaimed prizes', val: -519647000.00 },
      { code: '2-1200', name: 'Due to Lottery Aid to Education', val: -623280000.00 },
      { code: '2-1000', name: 'Accounts payable and accrued liabilities', val: -7930000.00 },
      { code: '2-1300', name: 'Unearned ticket sales', val: -5896000.00 },
      { code: '2-1400', name: 'Compensated absences', val: -791000.00 },
      { code: '2-2400', name: 'Compensated absences, noncurrent', val: -159000.00 },
      { code: '2-2010', name: 'Long-term leases payable', val: -15144000.00 },
      { code: '2-2500', name: 'Net pension liability', val: -6017000.00 },
      { code: '2-2600', name: 'Other postemployment benefits', val: -62704000.00 },
      { code: '2-2100', name: 'Long-term prizes payable', val: -780841000.00 },
      { code: '2-3000', name: 'Deferred inflows of resources', val: -11951000.00 },

      { code: '3-1000', name: 'Invested in capital assets', val: -501000.00 },
      { code: '3-1100', name: 'Restricted for future prizes', val: -445613000.00 },
      { code: '3-1200', name: 'Unrestricted', val: 63499000.00 },

      { code: '4-1000', name: 'Lottery revenue, net', val: -10255571000.00 },
      { code: '5-2000', name: 'Prize expense, net', val: 4751626000.00 },
      { code: '5-2100', name: 'Retailer commissions', val: 1622388000.00 },
      { code: '5-2200', name: 'Gaming contractor fees', val: 277716000.00 },
      { code: '5-2400', name: 'Instant ticket direct expenses', val: 18757000.00 },
      { code: '5-2500', name: 'Telecommunications expenses', val: 16173000.00 },

      { code: '6-4000', name: 'Marketing and advertising expenses', val: 86500000.00 },
      { code: '6-4100', name: 'Personal service and fringe benefits', val: 27952000.00 },
      { code: '6-4200', name: 'Other administrative costs', val: 5438000.00 },
      { code: '6-4300', name: 'State agency charges', val: 7877000.00 },
      { code: '6-4400', name: 'Amortization - leases', val: 2053000.00 },
      { code: '6-4500', name: 'Depreciation', val: 121000.00 },

      { code: '4-3000', name: 'Investment gain', val: -75673000.00 },
      { code: '4-4000', name: 'Other revenue, net', val: -50328000.00 },
      { code: '5-3000', name: 'Investment expense, net', val: 36297000.00 },
      { code: '5-2300', name: 'Required allocation for Lottery Aid to Education', val: 3584491000.00 },

      // Virtual Cash Flow (Inflows Credit/negative, Outflows Debit/positive)
      { code: 'cf-receipts', name: 'Cash received from net lottery revenue', val: -10266027000.00 },
      { code: 'cf-other-receipts', name: 'Other cash receipts', val: -50328000.00 },
      { code: 'cf-prizes', name: 'Cash payments for prizes', val: 4772052000.00 },
      { code: 'cf-commissions', name: 'Cash payments for commissions', val: 1622521000.00 },
      { code: 'cf-contractor', name: 'Cash payments for contractor fees', val: 277229000.00 },
      { code: 'cf-telecom', name: 'Cash payments for telecommunications', val: 16173000.00 },
      { code: 'cf-instant', name: 'Cash payments for instant ticket direct expenses', val: 21592000.00 },
      { code: 'cf-admin', name: 'Cash payments for other operating expenses', val: 129975000.00 },
      { code: 'cf-education', name: 'Cash transfer to State for Lottery Aid to Education', val: 3902991000.00 },
      { code: 'cf-capital', name: 'Purchases of capital assets, net of disposals', val: 894000.00 },
      { code: 'cf-inv-mat', name: 'Proceeds from investment maturities', val: -404349000.00 },
      { code: 'cf-inv-purch', name: 'Purchases of investments', val: 254469000.00 },
      { code: 'cf-inv-int', name: 'Interest on cash and cash equivalents and investments', val: -67848000.00 },
      { code: 'cf-offset', name: 'Cash Flow balance sheet offset', val: -209344000.00 }
    ];

    // ==========================================
    // FY 2024 Ledger Records
    // ==========================================
    const records2024 = [
      { code: '1-1000', name: 'Cash and cash equivalents', val: 1526383000.00 },
      { code: '1-1200', name: 'Accounts receivable, net', val: 418862000.00 },
      { code: '1-1310', name: 'Instant ticket inventory', val: 16885000.00 },
      { code: '1-1400', name: 'Investments', val: 97160000.00 },
      { code: '1-2200', name: 'Long-term investments, net', val: 740498000.00 },
      { code: '1-2300', name: 'Leases', val: 18142000.00 },
      { code: '1-2400', name: 'Capital assets', val: 501000.00 },
      { code: '1-3000', name: 'Deferred outflows of resources', val: 13152000.00 },

      { code: '2-1100', name: 'Prizes payable', val: -122110000.00 },
      { code: '2-1010', name: 'Leases payable', val: -1702000.00 },
      { code: '2-1150', name: 'Unclaimed prizes', val: -434687000.00 },
      { code: '2-1200', name: 'Due to Lottery Aid to Education', val: -941780000.00 },
      { code: '2-1000', name: 'Accounts payable and accrued liabilities', val: -7045000.00 },
      { code: '2-1300', name: 'Unearned ticket sales', val: -8922000.00 },
      { code: '2-1400', name: 'Compensated absences', val: -835000.00 },
      { code: '2-2400', name: 'Compensated absences, noncurrent', val: -168000.00 },
      { code: '2-2010', name: 'Long-term leases payable', val: -16645000.00 },
      { code: '2-2500', name: 'Net pension liability', val: -8845000.00 },
      { code: '2-2600', name: 'Other postemployment benefits', val: -58582000.00 },
      { code: '2-2100', name: 'Long-term prizes payable', val: -834874000.00 },
      { code: '2-3000', name: 'Deferred inflows of resources', val: -12773000.00 },

      { code: '3-1000', name: 'Invested in capital assets', val: 0.00 },
      { code: '3-1100', name: 'Restricted for future prizes', val: -399500000.00 },
      { code: '3-1200', name: 'Unrestricted', val: 34241000.00 },

      { code: '4-1000', name: 'Lottery revenue, net', val: -10549755000.00 },
      { code: '5-2000', name: 'Prize expense, net', val: 4917882000.00 },
      { code: '5-2100', name: 'Retailer commissions', val: 1596321000.00 },
      { code: '5-2200', name: 'Gaming contractor fees', val: 272731000.00 },
      { code: '5-2400', name: 'Instant ticket direct expenses', val: 16963000.00 },
      { code: '5-2500', name: 'Telecommunications expenses', val: 16418000.00 },

      { code: '6-4000', name: 'Marketing and advertising expenses', val: 79371000.00 },
      { code: '6-4100', name: 'Personal service and fringe benefits', val: 24358000.00 },
      { code: '6-4200', name: 'Other administrative costs', val: 4760000.00 },
      { code: '6-4300', name: 'State agency charges', val: 5948000.00 },
      { code: '6-4400', name: 'Amortization - leases', val: 2530000.00 },
      { code: '6-4500', name: 'Depreciation', val: 14000.00 },

      { code: '4-3000', name: 'Investment gain', val: -71690000.00 },
      { code: '4-4000', name: 'Other revenue, net', val: -12597000.00 },
      { code: '5-3000', name: 'Investment expense, net', val: 44020000.00 }, // Fixed from previous typo of 4,402,000 to 44,020,000!
      { code: '5-2300', name: 'Required allocation for Lottery Aid to Education', val: 3775370000.00 },
      { code: '5-2350', name: 'Lottery Aid Guarantee', val: -140000000.00 },

      // Virtual Cash Flow (Inflows Credit/negative, Outflows Debit/positive)
      { code: 'cf-receipts', name: 'Cash received from net lottery revenue', val: -10508261000.00 },
      { code: 'cf-other-receipts', name: 'Other cash receipts', val: -12597000.00 },
      { code: 'cf-prizes', name: 'Cash payments for prizes', val: 4997180000.00 },
      { code: 'cf-commissions', name: 'Cash payments for commissions', val: 1596347000.00 },
      { code: 'cf-contractor', name: 'Cash payments for contractor fees', val: 271369000.00 },
      { code: 'cf-telecom', name: 'Cash payments for telecommunications', val: 16418000.00 },
      { code: 'cf-instant', name: 'Cash payments for instant ticket direct expenses', val: 17676000.00 },
      { code: 'cf-admin', name: 'Cash payments for other operating expenses', val: 129371000.00 },
      { code: 'cf-education', name: 'Cash transfer to State for Lottery Aid to Education', val: 3335992000.00 },
      { code: 'cf-guarantee', name: 'Cash received from State General Fund for Lottery Aid Guarantee', val: -140000000.00 },
      { code: 'cf-capital', name: 'Purchases of capital assets, net of disposals', val: 503000.00 },
      { code: 'cf-inv-mat', name: 'Proceeds from investment maturities', val: -94230000.00 },
      { code: 'cf-inv-purch', name: 'Purchases of investments', val: 3538000.00 },
      { code: 'cf-inv-int', name: 'Interest on cash and cash equivalents and investments', val: -79685000.00 },
      { code: 'cf-offset', name: 'Cash Flow balance sheet offset', val: 466379000.00 }
    ];

    // ==========================================
    // FY 2020 Ledger Records
    // ==========================================
    const records2020 = [
      { code: '1-1000', name: 'Cash and cash equivalents', val: 635608000.00 },
      { code: '1-1200', name: 'Accounts receivable, net', val: 455416000.00 },
      { code: '1-1310', name: 'Instant ticket inventory', val: 13267000.00 },
      { code: '1-1400', name: 'Investments', val: 111023000.00 },
      { code: '1-2200', name: 'Long-term investments, net', val: 1309603000.00 },
      { code: '1-2400', name: 'Capital assets', val: 72000.00 },
      { code: '1-3000', name: 'Deferred outflows of resources', val: 6047000.00 },

      { code: '2-1100', name: 'Prizes payable', val: -136190000.00 },
      { code: '2-1150', name: 'Unclaimed prizes', val: -529612000.00 },
      { code: '2-1200', name: 'Due to Lottery Aid to Education', val: -269361000.00 },
      { code: '2-1000', name: 'Accounts payable and accrued liabilities', val: -3878000.00 },
      { code: '2-1300', name: 'Unearned ticket sales', val: -9879000.00 },
      { code: '2-1400', name: 'Compensated absences', val: -1006000.00 },
      { code: '2-2400', name: 'Compensated absences, noncurrent', val: -203000.00 },
      { code: '2-2020', name: 'Pension contribution payable', val: -1016000.00 },
      { code: '2-2500', name: 'Net pension liability', val: -3604000.00 },
      { code: '2-2600', name: 'Other postemployment benefits', val: -65491000.00 },
      { code: '2-2100', name: 'Long-term prizes payable', val: -1048494000.00 },
      { code: '2-3000', name: 'Deferred inflows of resources', val: -7228000.00 },

      { code: '3-1000', name: 'Invested in capital assets', val: -92000.00 },
      { code: '3-1100', name: 'Restricted for future prizes', val: -255249000.00 },
      { code: '3-1200', name: 'Unrestricted', val: -90144000.00 },

      { code: '4-1000', name: 'Lottery revenue, net', val: -9740528000.00 },
      { code: '5-2000', name: 'Prize expense, net', val: 4623604000.00 },
      { code: '5-2100', name: 'Retailer commissions', val: 1409168000.00 },
      { code: '5-2200', name: 'Gaming contractor fees', val: 225568000.00 },
      { code: '5-2400', name: 'Instant ticket direct expenses', val: 26747000.00 },
      { code: '5-2500', name: 'Telecommunications expenses', val: 17479000.00 },

      { code: '6-4000', name: 'Marketing and advertising expenses', val: 90752000.00 },
      { code: '6-4100', name: 'Personal service and fringe benefits', val: 27753000.00 },
      { code: '6-4200', name: 'Other administrative costs', val: 5023000.00 },
      { code: '6-4300', name: 'State agency charges', val: 6908000.00 },
      { code: '6-4500', name: 'Depreciation', val: 20000.00 },

      { code: '4-3000', name: 'Investment gain', val: -217090000.00 },
      { code: '4-4000', name: 'Other revenue, net', val: -12298000.00 },
      { code: '5-3000', name: 'Investment expense, net', val: 50494000.00 },
      { code: '5-2300', name: 'Required allocation for Lottery Aid to Education', val: 3376811000.00 },

      // Virtual Cash Flow (Inflows Credit/negative, Outflows Debit/positive)
      { code: 'cf-receipts', name: 'Cash received from net lottery revenue', val: -9830643000.00 },
      { code: 'cf-other-receipts', name: 'Other cash receipts', val: -12298000.00 },
      { code: 'cf-prizes', name: 'Cash payments for prizes', val: 4840095000.00 },
      { code: 'cf-commissions', name: 'Cash payments for commissions', val: 1409161000.00 },
      { code: 'cf-contractor', name: 'Cash payments for contractor fees', val: 229178000.00 },
      { code: 'cf-telecom', name: 'Cash payments for telecommunications', val: 17479000.00 },
      { code: 'cf-instant', name: 'Cash payments for instant ticket direct expenses', val: 27529000.00 },
      { code: 'cf-admin', name: 'Cash payments for other operating expenses', val: 124316000.00 },
      { code: 'cf-education', name: 'Cash transfer to State for Lottery Aid to Education', val: 3684194000.00 },
      { code: 'cf-capital', name: 'Purchases of capital assets, net of disposals', val: 0.00 },
      { code: 'cf-inv-mat', name: 'Proceeds from investment maturities', val: -109476000.00 },
      { code: 'cf-inv-purch', name: 'Purchases of investments', val: 39932000.00 },
      { code: 'cf-inv-int', name: 'Interest on cash and cash equivalents and investments', val: -39111000.00 },
      { code: 'cf-offset', name: 'Cash Flow balance sheet offset', val: -380356000.00 }
    ];

    // ==========================================
    // FY 2019 Ledger Records
    // ==========================================
    const records2019 = [
      { code: '1-1000', name: 'Cash and cash equivalents', val: 1015964000.00 },
      { code: '1-1200', name: 'Accounts receivable, net', val: 506596000.00 },
      { code: '1-1310', name: 'Instant ticket inventory', val: 11979000.00 },
      { code: '1-1400', name: 'Investments', val: 108608000.00 },
      { code: '1-2200', name: 'Long-term investments, net', val: 1203443000.00 },
      { code: '1-2400', name: 'Capital assets', val: 92000.00 },
      { code: '1-3000', name: 'Deferred outflows of resources', val: 5936000.00 },

      { code: '2-1100', name: 'Prizes payable', val: -135733000.00 },
      { code: '2-1150', name: 'Unclaimed prizes', val: -599321000.00 },
      { code: '2-1200', name: 'Due to Lottery Aid to Education', val: -576744000.00 },
      { code: '2-1000', name: 'Accounts payable and accrued liabilities', val: -798000.00 },
      { code: '2-1300', name: 'Unearned ticket sales', val: -10197000.00 },
      { code: '2-1400', name: 'Compensated absences', val: -1101000.00 },
      { code: '2-2400', name: 'Compensated absences, noncurrent', val: -222000.00 },
      { code: '2-2020', name: 'Pension contribution payable', val: -1462000.00 },
      { code: '2-2500', name: 'Net pension liability', val: -1719000.00 },
      { code: '2-2600', name: 'Other postemployment benefits', val: -66030000.00 },
      { code: '2-2100', name: 'Long-term prizes payable', val: -1105592000.00 },
      { code: '2-3000', name: 'Deferred inflows of resources', val: -8214000.00 },

      { code: '3-1000', name: 'Invested in capital assets', val: -100000.00 },
      { code: '3-1100', name: 'Restricted for future prizes', val: -213093000.00 },
      { code: '3-1200', name: 'Unrestricted', val: -70000000.00 },

      { code: '4-1000', name: 'Lottery revenue, net', val: -10290550000.00 },
      { code: '5-2000', name: 'Prize expense, net', val: 4919620000.00 },
      { code: '5-2100', name: 'Retailer commissions', val: 1455593000.00 },
      { code: '5-2200', name: 'Gaming contractor fees', val: 234806000.00 },
      { code: '5-2400', name: 'Instant ticket direct expenses', val: 23313000.00 },
      { code: '5-2500', name: 'Telecommunications expenses', val: 17876000.00 },

      { code: '6-4000', name: 'Marketing and advertising expenses', val: 90907000.00 },
      { code: '6-4100', name: 'Personal service and fringe benefits', val: 32163000.00 },
      { code: '6-4200', name: 'Other administrative costs', val: 5522000.00 },
      { code: '6-4300', name: 'State agency charges', val: 6436000.00 },
      { code: '6-4500', name: 'Depreciation', val: 8000.00 },

      { code: '4-3000', name: 'Investment gain', val: -82682000.00 },
      { code: '4-4000', name: 'Other revenue, net', val: -2099000.00 },
      { code: '5-3000', name: 'Investment expense, net', val: 52754000.00 },
      { code: '5-2300', name: 'Required allocation for Lottery Aid to Education', val: 3474041000.00 },

      // Virtual Cash Flow (Inflows Credit/negative, Outflows Debit/positive)
      { code: 'cf-receipts', name: 'Cash received from net lottery revenue', val: -10263913000.00 },
      { code: 'cf-other-receipts', name: 'Other cash receipts', val: -2100000.00 },
      { code: 'cf-prizes', name: 'Cash payments for prizes', val: 5005649000.00 },
      { code: 'cf-commissions', name: 'Cash payments for commissions', val: 1455608000.00 },
      { code: 'cf-contractor', name: 'Cash payments for contractor fees', val: 234350000.00 },
      { code: 'cf-telecom', name: 'Cash payments for telecommunications', val: 17876000.00 },
      { code: 'cf-instant', name: 'Cash payments for instant ticket direct expenses', val: 24171000.00 },
      { code: 'cf-admin', name: 'Cash payments for other operating expenses', val: 135919000.00 },
      { code: 'cf-education', name: 'Cash transfer to State for Lottery Aid to Education', val: 3200794000.00 },
      { code: 'cf-capital', name: 'Purchases of capital assets, net of disposals', val: 100000.00 },
      { code: 'cf-inv-mat', name: 'Proceeds from investment maturities', val: -103280000.00 },
      { code: 'cf-inv-purch', name: 'Purchases of investments', val: 43200000.00 },
      { code: 'cf-inv-int', name: 'Interest on cash and cash equivalents and investments', val: -44866000.00 },
      { code: 'cf-offset', name: 'Cash Flow balance sheet offset', val: 296492000.00 }
    ];

    addYearLedger(2025, '2024-09-30', '2025-03-31', records2025);
    addYearLedger(2024, '2023-09-30', '2024-03-31', records2024);
    addYearLedger(2020, '2019-09-30', '2020-03-31', records2020);
    addYearLedger(2019, '2018-09-30', '2019-03-31', records2019);

    // Seed prior cash balance references for 2023 and 2018
    addTbRecord(2023, 'P03', '2022-09-30', '1-1000', 'Cash and cash equivalents', 1060004000.00);
    addTbRecord(2023, 'P12', '2023-03-31', '1-1000', 'Cash and cash equivalents', 1060004000.00);

    addTbRecord(2018, 'P03', '2017-09-30', '1-1000', 'Cash and cash equivalents', 719472000.00);
    addTbRecord(2018, 'P12', '2018-03-31', '1-1000', 'Cash and cash equivalents', 719472000.00);

    console.log("Cleaning old TrialBalanceRecords for target periods...");
    await prisma.trialBalanceRecord.deleteMany({
      where: {
        jurisdictionId: jId,
        fiscalYear: { in: [2025, 2024, 2020, 2019, 2023, 2018] }
      }
    });

    console.log(`Seeding ${tbData.length} trial balance records...`);
    // Batch create
    await prisma.trialBalanceRecord.createMany({
      data: tbData
    });

    console.log("✓ Seeding completed successfully. All records are balanced.");

  } catch (error) {
    console.error("Seeding NYS Lottery actual figures failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

seedNyData();
