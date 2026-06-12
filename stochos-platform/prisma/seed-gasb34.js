// prisma/seed-gasb34.js
// Seeds a complete, double-entry balanced trial balance for FY2025 P03 and FY2024 P03.

const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });

const { prisma } = require('../lib/db.js');

async function seedGasb34() {
  try {
    const jurisdictionId = 'NY-LOTTERY';
    const periodDate = new Date('2024-09-30'); // period P03
    const periodDatePrior = new Date('2023-09-30'); // prior P03

    // Ensure jurisdiction exists
    const existingJ = await prisma.jurisdiction.findFirst({
      where: { OR: [{ id: jurisdictionId }, { abbreviation: 'NY' }] }
    });
    const jId = existingJ ? existingJ.id : jurisdictionId;

    console.log(`Using jurisdiction ID: ${jId}`);

    // Ensure default Pipeline (ledger grid) exists
    console.log("Checking for active ledger grid (Pipeline)...");
    const existingPipeline = await prisma.pipeline.findFirst({
      where: { name: 'NYSGC General Ledger Grid' }
    });
    if (!existingPipeline) {
      await prisma.pipeline.create({
        data: {
          id: 'nysgc-gl-pipeline',
          organizationId: 'default-org',
          name: 'NYSGC General Ledger Grid',
          description: 'Standard three-column ledger upload configuration',
          schemaVersion: '1.0',
          createdBy: 'system',
          pipelineJson: {
            nodes: [
              {
                type: 'normalize_sign',
                field: 'accountCode'
              }
            ]
          }
        }
      });
      console.log("✓ Created NYSGC General Ledger Grid Pipeline.");
    } else {
      console.log("✓ Pipeline already exists.");
    }

    const records = [
      // ==========================================
      // FY 2025 P03 (Current Year comparative)
      // ==========================================
      { jurisdictionId: jId, periodDate, fiscalYear: 2025, periodCode: 'P03', accountCode: '1-1000', accountName: 'Cash and Cash Equivalents', balance: 231000000.00 },
      { jurisdictionId: jId, periodDate, fiscalYear: 2025, periodCode: 'P03', accountCode: '1-1200', accountName: 'Accounts Receivable', balance: 45000000.00 },
      { jurisdictionId: jId, periodDate, fiscalYear: 2025, periodCode: 'P03', accountCode: '1-1201', accountName: 'Allowance for Doubtful Accounts', balance: -5000000.00 },
      { jurisdictionId: jId, periodDate, fiscalYear: 2025, periodCode: 'P03', accountCode: '1-1300', accountName: 'Prepaid Expenses', balance: 8000000.00 },
      { jurisdictionId: jId, periodDate, fiscalYear: 2025, periodCode: 'P03', accountCode: '1-2000', accountName: 'Capital Assets', balance: 110000000.00 },
      { jurisdictionId: jId, periodDate, fiscalYear: 2025, periodCode: 'P03', accountCode: '1-2100', accountName: 'Accumulated Depreciation', balance: -35000000.00 },
      
      { jurisdictionId: jId, periodDate, fiscalYear: 2025, periodCode: 'P03', accountCode: '2-1000', accountName: 'Accounts Payable', balance: -28000000.00 },
      { jurisdictionId: jId, periodDate, fiscalYear: 2025, periodCode: 'P03', accountCode: '2-1100', accountName: 'Prizes Payable', balance: -112000000.00 },
      { jurisdictionId: jId, periodDate, fiscalYear: 2025, periodCode: 'P03', accountCode: '2-1200', accountName: 'Due to Education Fund', balance: -45000000.00 },
      { jurisdictionId: jId, periodDate, fiscalYear: 2025, periodCode: 'P03', accountCode: '2-1300', accountName: 'Unearned Revenue', balance: -12000000.00 },
      
      { jurisdictionId: jId, periodDate, fiscalYear: 2025, periodCode: 'P03', accountCode: '3-1000', accountName: 'Net Investment in Capital Assets', balance: -75000000.00 },
      { jurisdictionId: jId, periodDate, fiscalYear: 2025, periodCode: 'P03', accountCode: '3-1100', accountName: 'Restricted for Prizes', balance: -50000000.00 },
      { jurisdictionId: jId, periodDate, fiscalYear: 2025, periodCode: 'P03', accountCode: '3-1200', accountName: 'Unrestricted Net Position', balance: -30000000.00 },
      
      { jurisdictionId: jId, periodDate, fiscalYear: 2025, periodCode: 'P03', accountCode: '4-1000', accountName: 'Gross Ticket Sales', balance: -850000000.00 },
      { jurisdictionId: jId, periodDate, fiscalYear: 2025, periodCode: 'P03', accountCode: '5-2000', accountName: 'Prize Expense', balance: 520000000.00 },
      { jurisdictionId: jId, periodDate, fiscalYear: 2025, periodCode: 'P03', accountCode: '5-2100', accountName: 'Retailer Commissions', balance: 48000000.00 },
      { jurisdictionId: jId, periodDate, fiscalYear: 2025, periodCode: 'P03', accountCode: '5-2200', accountName: 'Vendor Gaming Fees', balance: 22000000.00 },
      { jurisdictionId: jId, periodDate, fiscalYear: 2025, periodCode: 'P03', accountCode: '6-4000', accountName: 'Advertising & Marketing', balance: 12000000.00 },
      { jurisdictionId: jId, periodDate, fiscalYear: 2025, periodCode: 'P03', accountCode: '6-4100', accountName: 'Salaries & Wages', balance: 15000000.00 },
      { jurisdictionId: jId, periodDate, fiscalYear: 2025, periodCode: 'P03', accountCode: '6-4200', accountName: 'G&A', balance: 8000000.00 },
      
      { jurisdictionId: jId, periodDate, fiscalYear: 2025, periodCode: 'P03', accountCode: '4-3000', accountName: 'Investment Income', balance: -4000000.00 },
      { jurisdictionId: jId, periodDate, fiscalYear: 2025, periodCode: 'P03', accountCode: '5-2300', accountName: 'Benefactor Transfer', balance: 227000000.00 },

      // ==========================================
      // FY 2024 P03 (Prior Year comparative)
      // ==========================================
      { jurisdictionId: jId, periodDate: periodDatePrior, fiscalYear: 2024, periodCode: 'P03', accountCode: '1-1000', accountName: 'Cash and Cash Equivalents', balance: 220000000.00 },
      { jurisdictionId: jId, periodDate: periodDatePrior, fiscalYear: 2024, periodCode: 'P03', accountCode: '1-1200', accountName: 'Accounts Receivable', balance: 42000000.00 },
      { jurisdictionId: jId, periodDate: periodDatePrior, fiscalYear: 2024, periodCode: 'P03', accountCode: '1-1201', accountName: 'Allowance for Doubtful Accounts', balance: -4000000.00 },
      { jurisdictionId: jId, periodDate: periodDatePrior, fiscalYear: 2024, periodCode: 'P03', accountCode: '1-1300', accountName: 'Prepaid Expenses', balance: 7000000.00 },
      { jurisdictionId: jId, periodDate: periodDatePrior, fiscalYear: 2024, periodCode: 'P03', accountCode: '1-2000', accountName: 'Capital Assets', balance: 100000000.00 },
      { jurisdictionId: jId, periodDate: periodDatePrior, fiscalYear: 2024, periodCode: 'P03', accountCode: '1-2100', accountName: 'Accumulated Depreciation', balance: -30000000.00 },
      
      { jurisdictionId: jId, periodDate: periodDatePrior, fiscalYear: 2024, periodCode: 'P03', accountCode: '2-1000', accountName: 'Accounts Payable', balance: -25000000.00 },
      { jurisdictionId: jId, periodDate: periodDatePrior, fiscalYear: 2024, periodCode: 'P03', accountCode: '2-1100', accountName: 'Prizes Payable', balance: -105000000.00 },
      { jurisdictionId: jId, periodDate: periodDatePrior, fiscalYear: 2024, periodCode: 'P03', accountCode: '2-1200', accountName: 'Due to Education Fund', balance: -40000000.00 },
      { jurisdictionId: jId, periodDate: periodDatePrior, fiscalYear: 2024, periodCode: 'P03', accountCode: '2-1300', accountName: 'Unearned Revenue', balance: -10000000.00 },
      
      { jurisdictionId: jId, periodDate: periodDatePrior, fiscalYear: 2024, periodCode: 'P03', accountCode: '3-1000', accountName: 'Net Investment in Capital Assets', balance: -70000000.00 },
      { jurisdictionId: jId, periodDate: periodDatePrior, fiscalYear: 2024, periodCode: 'P03', accountCode: '3-1100', accountName: 'Restricted for Prizes', balance: -45000000.00 },
      { jurisdictionId: jId, periodDate: periodDatePrior, fiscalYear: 2024, periodCode: 'P03', accountCode: '3-1200', accountName: 'Unrestricted Net Position', balance: -55000000.00 },
      
      { jurisdictionId: jId, periodDate: periodDatePrior, fiscalYear: 2024, periodCode: 'P03', accountCode: '4-1000', accountName: 'Gross Ticket Sales', balance: -820000000.00 },
      { jurisdictionId: jId, periodDate: periodDatePrior, fiscalYear: 2024, periodCode: 'P03', accountCode: '5-2000', accountName: 'Prize Expense', balance: 500000000.00 },
      { jurisdictionId: jId, periodDate: periodDatePrior, fiscalYear: 2024, periodCode: 'P03', accountCode: '5-2100', accountName: 'Retailer Commissions', balance: 46000000.00 },
      { jurisdictionId: jId, periodDate: periodDatePrior, fiscalYear: 2024, periodCode: 'P03', accountCode: '5-2200', accountName: 'Vendor Gaming Fees', balance: 21000000.00 },
      { jurisdictionId: jId, periodDate: periodDatePrior, fiscalYear: 2024, periodCode: 'P03', accountCode: '6-4000', accountName: 'Advertising & Marketing', balance: 11000000.00 },
      { jurisdictionId: jId, periodDate: periodDatePrior, fiscalYear: 2024, periodCode: 'P03', accountCode: '6-4100', accountName: 'Salaries & Wages', balance: 14000000.00 },
      { jurisdictionId: jId, periodDate: periodDatePrior, fiscalYear: 2024, periodCode: 'P03', accountCode: '6-4200', accountName: 'G&A', balance: 7000000.00 },
      
      { jurisdictionId: jId, periodDate: periodDatePrior, fiscalYear: 2024, periodCode: 'P03', accountCode: '4-3000', accountName: 'Investment Income', balance: -3000000.00 },
      { jurisdictionId: jId, periodDate: periodDatePrior, fiscalYear: 2024, periodCode: 'P03', accountCode: '5-2300', accountName: 'Benefactor Transfer', balance: 239000000.00 },
    ];

    console.log("Cleaning old TrialBalanceRecords for target periods...");
    await prisma.trialBalanceRecord.deleteMany({
      where: {
        jurisdictionId: jId,
        periodCode: 'P03'
      }
    });

    console.log("Seeding balanced GASB 34 Trial Balance records...");
    for (const r of records) {
      await prisma.trialBalanceRecord.create({ data: r });
    }
    console.log("✓ Seeding completed successfully. All records are balanced.");

    // Update crosswalk rules for additional items if not present
    const crosswalkRules = [
      { jurisdictionId: jId, accountPattern: '1-1000', metricId: 'sys-101', signageMultiplier: 1.0, effectiveStartDate: new Date('2020-01-01') },
      { jurisdictionId: jId, accountPattern: '1-1200', metricId: 'sys-102', signageMultiplier: 1.0, effectiveStartDate: new Date('2020-01-01') },
      { jurisdictionId: jId, accountPattern: '1-1201', metricId: 'sys-103', signageMultiplier: -1.0, effectiveStartDate: new Date('2020-01-01') },
      { jurisdictionId: jId, accountPattern: '1-1300', metricId: 'sys-104', signageMultiplier: 1.0, effectiveStartDate: new Date('2020-01-01') },
      { jurisdictionId: jId, accountPattern: '1-2000', metricId: 'sys-105', signageMultiplier: 1.0, effectiveStartDate: new Date('2020-01-01') },
      { jurisdictionId: jId, accountPattern: '1-2100', metricId: 'sys-106', signageMultiplier: -1.0, effectiveStartDate: new Date('2020-01-01') },
      { jurisdictionId: jId, accountPattern: '2-1000', metricId: 'sys-201', signageMultiplier: -1.0, effectiveStartDate: new Date('2020-01-01') },
      { jurisdictionId: jId, accountPattern: '2-1100', metricId: 'sys-202', signageMultiplier: -1.0, effectiveStartDate: new Date('2020-01-01') },
      { jurisdictionId: jId, accountPattern: '2-1200', metricId: 'sys-203', signageMultiplier: -1.0, effectiveStartDate: new Date('2020-01-01') },
      { jurisdictionId: jId, accountPattern: '2-1300', metricId: 'sys-204', signageMultiplier: -1.0, effectiveStartDate: new Date('2020-01-01') },
      { jurisdictionId: jId, accountPattern: '3-1000', metricId: 'sys-301', signageMultiplier: -1.0, effectiveStartDate: new Date('2020-01-01') },
      { jurisdictionId: jId, accountPattern: '3-1100', metricId: 'sys-302', signageMultiplier: -1.0, effectiveStartDate: new Date('2020-01-01') },
      { jurisdictionId: jId, accountPattern: '3-1200', metricId: 'sys-303', signageMultiplier: -1.0, effectiveStartDate: new Date('2020-01-01') },
    ];

    console.log("Seeding balance sheet crosswalk rules...");
    for (const rule of crosswalkRules) {
      await prisma.glCrosswalkRule.deleteMany({
        where: {
          jurisdictionId: jId,
          accountPattern: rule.accountPattern
        }
      });
      await prisma.glCrosswalkRule.create({ data: rule });
    }
    console.log("✓ Seeding balance sheet rules completed.");

    console.log("Cleaning old GASB statement row definitions (GasbRow)...");
    await prisma.gasbRow.deleteMany({
      where: { jurisdictionId: jId }
    });

    const gasbRows = [
      // Statement of Net Position (netPosition)
      { jurisdictionId: jId, statement: 'netPosition', section: 'currentAssets', label: 'Cash and cash equivalents', accountPattern: '1-1000', rowType: 'data', signageMultiplier: 1.0, sortOrder: 10 },
      { jurisdictionId: jId, statement: 'netPosition', section: 'currentAssets', label: 'Accounts receivable, net', accountPattern: '1-1200,1-1201', rowType: 'data', signageMultiplier: 1.0, sortOrder: 20 },
      { jurisdictionId: jId, statement: 'netPosition', section: 'currentAssets', label: 'Prepaid expenses', accountPattern: '1-1300', rowType: 'data', signageMultiplier: 1.0, sortOrder: 30 },
      { jurisdictionId: jId, statement: 'netPosition', section: 'currentAssets', label: 'Total current assets', accountPattern: '', rowType: 'total', signageMultiplier: 1.0, sortOrder: 40 },
      { jurisdictionId: jId, statement: 'netPosition', section: 'nonCurrentAssets', label: 'Capital assets, net of accumulated depreciation', accountPattern: '1-2000,1-2100', rowType: 'data', signageMultiplier: 1.0, sortOrder: 50 },
      { jurisdictionId: jId, statement: 'netPosition', section: 'nonCurrentAssets', label: 'Total Assets', accountPattern: '', rowType: 'total', signageMultiplier: 1.0, sortOrder: 60 },
      { jurisdictionId: jId, statement: 'netPosition', section: 'liabilities', label: 'Accounts payable', accountPattern: '2-1000', rowType: 'data', signageMultiplier: -1.0, sortOrder: 70 },
      { jurisdictionId: jId, statement: 'netPosition', section: 'liabilities', label: 'Prizes payable', accountPattern: '2-1100', rowType: 'data', signageMultiplier: -1.0, sortOrder: 80 },
      { jurisdictionId: jId, statement: 'netPosition', section: 'liabilities', label: 'Due to education fund', accountPattern: '2-1200', rowType: 'data', signageMultiplier: -1.0, sortOrder: 90 },
      { jurisdictionId: jId, statement: 'netPosition', section: 'liabilities', label: 'Unearned revenue', accountPattern: '2-1300', rowType: 'data', signageMultiplier: -1.0, sortOrder: 100 },
      { jurisdictionId: jId, statement: 'netPosition', section: 'liabilities', label: 'Total Liabilities / Current Liabilities', accountPattern: '', rowType: 'total', signageMultiplier: 1.0, sortOrder: 110 },
      { jurisdictionId: jId, statement: 'netPosition', section: 'netPosition', label: 'Net investment in capital assets', accountPattern: '3-1000', rowType: 'data', signageMultiplier: -1.0, sortOrder: 120 },
      { jurisdictionId: jId, statement: 'netPosition', section: 'netPosition', label: 'Restricted for prizes', accountPattern: '3-1100', rowType: 'data', signageMultiplier: -1.0, sortOrder: 130 },
      { jurisdictionId: jId, statement: 'netPosition', section: 'netPosition', label: 'Unrestricted', accountPattern: '3-1200', rowType: 'data', signageMultiplier: -1.0, sortOrder: 140 },
      { jurisdictionId: jId, statement: 'netPosition', section: 'netPosition', label: 'Total Net Position', accountPattern: '', rowType: 'total', signageMultiplier: 1.0, sortOrder: 150 },

      // Statement of Revenues, Expenses, and Changes in Fund Net Position (revenuesExpenses)
      { jurisdictionId: jId, statement: 'revenuesExpenses', section: 'operatingRevenues', label: 'Gross ticket sales', accountPattern: '4-1000', rowType: 'data', signageMultiplier: -1.0, sortOrder: 10 },
      { jurisdictionId: jId, statement: 'revenuesExpenses', section: 'operatingRevenues', label: 'Total Operating Revenues', accountPattern: '', rowType: 'total', signageMultiplier: 1.0, sortOrder: 20 },
      { jurisdictionId: jId, statement: 'revenuesExpenses', section: 'operatingExpenses', label: 'Prize expense', accountPattern: '5-2000', rowType: 'data', signageMultiplier: 1.0, sortOrder: 30 },
      { jurisdictionId: jId, statement: 'revenuesExpenses', section: 'operatingExpenses', label: 'Retailer commissions', accountPattern: '5-2100', rowType: 'data', signageMultiplier: 1.0, sortOrder: 40 },
      { jurisdictionId: jId, statement: 'revenuesExpenses', section: 'operatingExpenses', label: 'Vendor gaming fees', accountPattern: '5-2200', rowType: 'data', signageMultiplier: 1.0, sortOrder: 50 },
      { jurisdictionId: jId, statement: 'revenuesExpenses', section: 'operatingExpenses', label: 'Advertising and marketing', accountPattern: '6-4000', rowType: 'data', signageMultiplier: 1.0, sortOrder: 60 },
      { jurisdictionId: jId, statement: 'revenuesExpenses', section: 'operatingExpenses', label: 'Salaries and wages', accountPattern: '6-4100', rowType: 'data', signageMultiplier: 1.0, sortOrder: 70 },
      { jurisdictionId: jId, statement: 'revenuesExpenses', section: 'operatingExpenses', label: 'G&A overhead costs', accountPattern: '6-4200', rowType: 'data', signageMultiplier: 1.0, sortOrder: 80 },
      { jurisdictionId: jId, statement: 'revenuesExpenses', section: 'operatingExpenses', label: 'Total Operating Expenses', accountPattern: '', rowType: 'total', signageMultiplier: 1.0, sortOrder: 90 },
      { jurisdictionId: jId, statement: 'revenuesExpenses', section: 'operatingExpenses', label: 'Operating Income (Loss)', accountPattern: '', rowType: 'total', signageMultiplier: 1.0, sortOrder: 100 },
      { jurisdictionId: jId, statement: 'revenuesExpenses', section: 'nonOperating', label: 'Investment interest income', accountPattern: '4-3000', rowType: 'data', signageMultiplier: -1.0, sortOrder: 110 },
      { jurisdictionId: jId, statement: 'revenuesExpenses', section: 'nonOperating', label: 'Transfers out (Education benefactor)', accountPattern: '5-2300', rowType: 'data', signageMultiplier: 1.0, sortOrder: 120 },
      { jurisdictionId: jId, statement: 'revenuesExpenses', section: 'nonOperating', label: 'Total Non-Operating Revenues (Expenses)', accountPattern: '', rowType: 'total', signageMultiplier: 1.0, sortOrder: 130 },
      { jurisdictionId: jId, statement: 'revenuesExpenses', section: 'nonOperating', label: 'Change in Net Position', accountPattern: '', rowType: 'total', signageMultiplier: 1.0, sortOrder: 140 },
      { jurisdictionId: jId, statement: 'revenuesExpenses', section: 'nonOperating', label: 'Net Position, Beginning of Period', accountPattern: '', rowType: 'total', signageMultiplier: 1.0, sortOrder: 150 },
      { jurisdictionId: jId, statement: 'revenuesExpenses', section: 'nonOperating', label: 'Net Position, End of Period', accountPattern: '', rowType: 'total', signageMultiplier: 1.0, sortOrder: 160 },

      // Statement of Cash Flows (cashFlows)
      { jurisdictionId: jId, statement: 'cashFlows', section: 'cashOperating', label: 'Receipts from customers', accountPattern: '4-1000,1-1200,1-1201,2-1300', rowType: 'data', signageMultiplier: 1.0, sortOrder: 10 },
      { jurisdictionId: jId, statement: 'cashFlows', section: 'cashOperating', label: 'Payments for prizes', accountPattern: '5-2000,2-1100', rowType: 'data', signageMultiplier: -1.0, sortOrder: 20 },
      { jurisdictionId: jId, statement: 'cashFlows', section: 'cashOperating', label: 'Payments to retailers for commissions and fees', accountPattern: '5-2100,5-2200', rowType: 'data', signageMultiplier: -1.0, sortOrder: 30 },
      { jurisdictionId: jId, statement: 'cashFlows', section: 'cashOperating', label: 'Payments to employees and vendors for goods/services', accountPattern: '6-4000,6-4100,6-4200,1-1300,2-1000,1-2100', rowType: 'data', signageMultiplier: -1.0, sortOrder: 40 },
      { jurisdictionId: jId, statement: 'cashFlows', section: 'cashOperating', label: 'Net Cash Provided by Operating Activities', accountPattern: '', rowType: 'total', signageMultiplier: 1.0, sortOrder: 50 },
      { jurisdictionId: jId, statement: 'cashFlows', section: 'cashFinancing', label: 'Transfers to education fund', accountPattern: '5-2300,2-1200', rowType: 'data', signageMultiplier: -1.0, sortOrder: 60 },
      { jurisdictionId: jId, statement: 'cashFlows', section: 'cashFinancing', label: 'Net Cash Used for Noncapital Financing Activities', accountPattern: '', rowType: 'total', signageMultiplier: 1.0, sortOrder: 70 },
      { jurisdictionId: jId, statement: 'cashFlows', section: 'cashCapital', label: 'Acquisition of capital assets', accountPattern: '1-2000', rowType: 'data', signageMultiplier: -1.0, sortOrder: 80 },
      { jurisdictionId: jId, statement: 'cashFlows', section: 'cashCapital', label: 'Net Cash Used for Capital Financing Activities', accountPattern: '', rowType: 'total', signageMultiplier: 1.0, sortOrder: 90 },
      { jurisdictionId: jId, statement: 'cashFlows', section: 'cashInvesting', label: 'Interest received', accountPattern: '4-3000', rowType: 'data', signageMultiplier: 1.0, sortOrder: 100 },
      { jurisdictionId: jId, statement: 'cashFlows', section: 'cashInvesting', label: 'Net Cash Provided by Investing Activities', accountPattern: '', rowType: 'total', signageMultiplier: 1.0, sortOrder: 110 },
      { jurisdictionId: jId, statement: 'cashFlows', section: 'cashRollForward', label: 'Net Increase in Cash and Cash Equivalents', accountPattern: '', rowType: 'total', signageMultiplier: 1.0, sortOrder: 120 },
      { jurisdictionId: jId, statement: 'cashFlows', section: 'cashRollForward', label: 'Cash and Cash Equivalents, Beginning of Period', accountPattern: '', rowType: 'total', signageMultiplier: 1.0, sortOrder: 130 },
      { jurisdictionId: jId, statement: 'cashFlows', section: 'cashRollForward', label: 'Cash and Cash Equivalents, End of Period', accountPattern: '', rowType: 'total', signageMultiplier: 1.0, sortOrder: 140 }
    ];

    console.log("Seeding default GASB statement row definitions...");
    for (const row of gasbRows) {
      await prisma.gasbRow.create({ data: row });
    }
    console.log("✓ Seeding GASB rows completed.");

  } catch (error) {
    console.error("Seeding GASB 34 failed:", error);
  } finally {
    await prisma.$disconnect();
  }
}

seedGasb34();
