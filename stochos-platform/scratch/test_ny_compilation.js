// scratch/test_ny_compilation.js
const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const { prisma } = require('../lib/db.js');

// Helper wildcard matcher
function matchPattern(accountCode, pattern) {
  const escaped = pattern.replace(/[-\/\\^$*+?.()|[\]{}]/g, (char) => {
    if (char === '*') return '.*';
    return '\\' + char;
  });
  const regex = new RegExp(`^${escaped}$`);
  return regex.test(accountCode);
}

// Calculate sum for a comma-separated list of patterns
function sumPatterns(records, patternsStr, signageMultiplier) {
  if (!patternsStr) return 0;
  const patterns = patternsStr.split(',').map(p => p.trim());
  let sum = 0;
  records.forEach(rec => {
    const isMatch = patterns.some(pattern => matchPattern(rec.accountCode, pattern));
    if (isMatch) {
      sum += parseFloat(rec.balance.toString());
    }
  });
  return sum * parseFloat(signageMultiplier.toString());
}

async function verifyYear(fiscalYear, periodCode) {
  console.log(`\n==================================================`);
  console.log(`Verifying Fiscal Year ${fiscalYear} (${periodCode})`);
  console.log(`==================================================`);

  const jurisdictionId = 'NY-LOTTERY';

  // 1. Fetch GasbRow definitions
  const dbRows = await prisma.gasbRow.findMany({
    where: { jurisdictionId },
    orderBy: { sortOrder: 'asc' }
  });

  if (dbRows.length === 0) {
    throw new Error('No GASB rows found.');
  }

  // 2. Fetch trial balance records
  const currentRecords = await prisma.trialBalanceRecord.findMany({
    where: { jurisdictionId, fiscalYear, periodCode }
  });

  const priorRecords = await prisma.trialBalanceRecord.findMany({
    where: { jurisdictionId, fiscalYear: fiscalYear - 1, periodCode }
  });

  if (currentRecords.length === 0) {
    throw new Error(`No records found for current year ${fiscalYear}`);
  }

  console.log(`Loaded ${currentRecords.length} records for ${fiscalYear}`);
  console.log(`Loaded ${priorRecords.length} records for ${fiscalYear - 1}`);

  // 3. Double-entry check
  const tbSum = currentRecords.reduce((sum, r) => sum + parseFloat(r.balance.toString()), 0);
  const isBalanced = Math.abs(tbSum) <= 0.05;
  console.log(`General Ledger Sum: $${tbSum.toFixed(2)} (Balanced: ${isBalanced})`);
  if (!isBalanced) {
    throw new Error(`Double-entry check failed for ${fiscalYear}! Sum = ${tbSum}`);
  }

  // 4. Compute row values
  const mapRowValues = (rows, currentRecs, priorRecs) => {
    return rows.map(row => {
      if (row.rowType === 'data') {
        const currentVal = sumPatterns(currentRecs, row.accountPattern, row.signageMultiplier);
        const priorVal = sumPatterns(priorRecs, row.accountPattern, row.signageMultiplier);
        return {
          ...row,
          current: currentVal,
          prior: priorVal
        };
      }
      return {
        ...row,
        current: 0,
        prior: 0
      };
    });
  };

  const npRowsRaw = dbRows.filter(r => r.statement === 'netPosition');
  const reRowsRaw = dbRows.filter(r => r.statement === 'revenuesExpenses');
  const cfRowsRaw = dbRows.filter(r => r.statement === 'cashFlows');

  const npRows = mapRowValues(npRowsRaw, currentRecords, priorRecords);
  const reRows = mapRowValues(reRowsRaw, currentRecords, priorRecords);
  const cfRows = mapRowValues(cfRowsRaw, currentRecords, priorRecords);

  const reVal = (label) => {
    const r = reRows.find(x => x.label === label);
    return r ? r.current : 0;
  };
  const npVal = (label) => {
    const r = npRows.find(x => x.label === label);
    return r ? r.current : 0;
  };

  // Run the compilation math
  const currentOpRevenues = reRows.filter(r => r.section === 'operatingRevenues' && r.rowType === 'data').reduce((s, r) => s + r.current, 0);
  const currentDirectExpenses = reRows.filter(r => r.section === 'directExpenses' && r.rowType === 'data').reduce((s, r) => s + r.current, 0);
  const currentIndirectExpenses = reRows.filter(r => r.section === 'indirectExpenses' && r.rowType === 'data').reduce((s, r) => s + r.current, 0);
  const currentOpExpenses = currentDirectExpenses + currentIndirectExpenses;
  const currentOpIncome = currentOpRevenues - currentOpExpenses;

  const currentNonOpRev = reRows.filter(r => r.section === 'nonOperating' && r.rowType === 'data').reduce((s, r) => {
    const lbl = r.label.toLowerCase().trim();
    if (lbl === 'investment gain' || lbl === 'other revenue, net' || lbl === 'investment interest income') {
      return s + r.current;
    }
    if (lbl === 'investment expense, net') {
      return s - r.current;
    }
    if (lbl === 'transfers out (education benefactor)') {
      return s - r.current;
    }
    return s;
  }, 0);

  const currentIncBeforeAlloc = currentOpIncome + currentNonOpRev;
  const currentRequiredAlloc = reVal('Required allocation for Lottery Aid to Education') || reVal('Transfers out (Education benefactor)');
  const currentGuarantee = reVal('Lottery Aid Guarantee');

  const isNewSeeder = reRows.some(r => r.label === 'Required allocation for Lottery Aid to Education');
  const currentChangeNetPos = isNewSeeder 
    ? (currentIncBeforeAlloc - currentRequiredAlloc + currentGuarantee) 
    : (currentOpIncome + currentNonOpRev);

  const currentBegNetPos = npRows.filter(r => r.section === 'netPosition' && r.rowType === 'data').reduce((s, r) => s + r.current, 0);
  const currentEndNetPos = currentBegNetPos + currentChangeNetPos;

  // Net Position calculations
  const currentCurrAssets = npRows.filter(r => r.section === 'currentAssets' && r.rowType === 'data').reduce((s, r) => s + r.current, 0);
  const currentNonCurrAssets = npRows.filter(r => r.section === 'nonCurrentAssets' && r.rowType === 'data').reduce((s, r) => s + r.current, 0);
  const currentTotalAssets = currentCurrAssets + currentNonCurrAssets;

  const currentCurrLiab = npRows.filter(r => r.section === 'currentLiabilities' && r.rowType === 'data').reduce((s, r) => s + r.current, 0);
  const currentNonCurrLiab = npRows.filter(r => r.section === 'nonCurrentLiabilities' && r.rowType === 'data').reduce((s, r) => s + r.current, 0);
  const currentTotalLiabilities = currentCurrLiab + currentNonCurrLiab;

  const currentEndNetPosFromBS = npRows.filter(r => r.section === 'netPosition' && r.rowType === 'data').reduce((s, r) => s + r.current, 0);
  // Wait, ending net position is calculated from BS components:
  // For 2025: Invested in capital assets (756k) + Restricted (393209k) + Unrestricted (-67167k) = 326798k
  const currentEndNetPosBSComponents = npVal('Invested in capital assets') + npVal('Restricted for future prizes') - Math.abs(npVal('Unrestricted'));

  // Cash Flows calculations
  const currentOpCash = cfRows.filter(r => r.section === 'cashOperating' && r.rowType === 'data').reduce((s, r) => s + r.current, 0);
  const currentFinancingCash = cfRows.filter(r => r.section === 'cashFinancing' && r.rowType === 'data').reduce((s, r) => s + r.current, 0);
  const currentCapitalCash = cfRows.filter(r => r.section === 'cashCapital' && r.rowType === 'data').reduce((s, r) => s + r.current, 0);
  const currentInvestingCash = cfRows.filter(r => r.section === 'cashInvesting' && r.rowType === 'data').reduce((s, r) => s + r.current, 0);
  const currentNetCashChange = currentOpCash + currentFinancingCash + currentCapitalCash + currentInvestingCash;

  // Print results
  console.log(`Operating Revenues:   $${(currentOpRevenues / 1e6).toFixed(3)}M`);
  console.log(`Operating Expenses:   $${(currentOpExpenses / 1e6).toFixed(3)}M`);
  console.log(`Operating Income:     $${(currentOpIncome / 1e6).toFixed(3)}M`);
  console.log(`Non-Operating Net:    $${(currentNonOpRev / 1e6).toFixed(3)}M`);
  console.log(`Required Allocation:  $${(currentRequiredAlloc / 1e6).toFixed(3)}M`);
  console.log(`Change in Net Pos:    $${(currentChangeNetPos / 1e6).toFixed(3)}M`);
  console.log(`Total Assets:         $${(currentTotalAssets / 1e6).toFixed(3)}M`);
  console.log(`Total Liabilities:    $${(currentTotalLiabilities / 1e6).toFixed(3)}M`);
  console.log(`Ending Net Position:  $${(currentEndNetPos / 1e6).toFixed(3)}M`);
  console.log(`Ending Cash Flow Net: $${(currentNetCashChange / 1e6).toFixed(3)}M`);

  // Target values map
  const targetMap = {
    2025: {
      opIncome: 3438970000.00,
      opCash: 3476813000.00,
      totalAssets: 2480249000.00,
      totalLiabilities: 2153324000.00,
      endNetPosition: 326798000.00
    },
    2024: {
      opIncome: 3612459000.00,
      opCash: 3492497000.00,
      totalAssets: 2818431000.00,
      totalLiabilities: 2436195000.00,
      endNetPosition: 382615000.00
    },
    2020: {
      opIncome: 3307506000.00,
      opCash: 3195183000.00,
      totalAssets: 2524989000.00,
      totalLiabilities: 2068734000.00,
      endNetPosition: 455074000.00
    },
    2019: {
      opIncome: 3504306000.00,
      opCash: 3392440000.00,
      totalAssets: 2846682000.00,
      totalLiabilities: 2498919000.00,
      endNetPosition: 345485000.00
    }
  };

  const targets = targetMap[fiscalYear];
  if (targets) {
    assertNear(currentOpIncome, targets.opIncome, 'Operating Income');
    assertNear(currentOpCash, targets.opCash, 'Operating Cash Flow');
    assertNear(currentTotalAssets, targets.totalAssets, 'Total Assets');
    assertNear(currentTotalLiabilities, targets.totalLiabilities, 'Total Liabilities');
    assertNear(currentEndNetPos, targets.endNetPosition, 'Ending Net Position');
  }

  console.log(`✓ FY ${fiscalYear} compiled statements verified successfully.`);
}

function assertNear(val, target, label) {
  const diff = Math.abs(val - target);
  if (diff > 10.0) { // Allow tiny rounding tolerance
    throw new Error(`[Assertion Failed] ${label} = $${val.toLocaleString()} but expected $${target.toLocaleString()} (Diff = $${diff})`);
  } else {
    console.log(`  [Pass] ${label} matches target`);
  }
}

async function runAll() {
  try {
    await verifyYear(2025, 'P12');
    await verifyYear(2025, 'P03');
    await verifyYear(2024, 'P12');
    await verifyYear(2024, 'P03');
    await verifyYear(2020, 'P12');
    await verifyYear(2020, 'P03');
    await verifyYear(2019, 'P12');
    await verifyYear(2019, 'P03');
    console.log('\nAll assertions passed! NYS Lottery historical figures compiled successfully.');
  } catch (error) {
    console.error('\nVerification failed:', error.message);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runAll();
