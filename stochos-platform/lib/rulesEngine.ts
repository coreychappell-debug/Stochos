import { prisma } from './db';

export interface RuleResult {
  id: string;
  name: string;
  description: string;
  status: 'passed' | 'warning' | 'failed';
  actualValue: string | number;
  expectedValue: string | number;
  details?: string;
}

export async function evaluateValidationRules(jurisdictionId: string, periodDate: Date): Promise<RuleResult[]> {
  // 1. Fetch trial balance records
  const records = await prisma.trialBalanceRecord.findMany({
    where: { jurisdictionId, periodDate }
  });

  // 2. Sum key GL account actuals and calculate total balance for double-entry check
  let grossSales = 0;
  let prizeExpense = 0;
  let commissions = 0;
  let totalBalance = 0;

  for (const r of records) {
    const code = r.accountCode || '';
    const val = parseFloat(r.balance.toString());
    totalBalance += val;

    if (code === '4-1000' || code.startsWith('40000') || code.startsWith('40100')) {
      grossSales += val;
    } else if (code === '5-2000' || code.startsWith('6410')) {
      prizeExpense += val;
    } else if (code === '5-2100' || code.startsWith('6420')) {
      commissions += val;
    }
  }

  const roundedTotal = Math.round(totalBalance * 100) / 100;
  const isBalanced = Math.abs(roundedTotal) <= 0.01;

  const results: RuleResult[] = [];

  // Rule 0: Double-Entry Balancing Check
  results.push({
    id: 'val-rule-double-entry',
    name: 'Double-Entry Balance Check',
    description: 'Verifies that the sum of all debit and credit balances in the General Ledger equals $0.00.',
    status: isBalanced ? 'passed' : 'warning',
    actualValue: `${roundedTotal >= 0 ? '' : '-'}$${Math.abs(roundedTotal).toFixed(2)}`,
    expectedValue: '$0.00',
    details: isBalanced
      ? 'The General Ledger is perfectly balanced ($0.00).'
      : `Warning: General Ledger is out of balance by $${roundedTotal.toFixed(2)}. Double-entry accounting requires debits and credits to reconcile to $0.00 before period lock.`
  });

  // Rule A: Positive Gross Ticket Sales
  const salesPassed = grossSales > 0;
  results.push({
    id: 'val-rule-sales',
    name: 'Positive Gross Ticket Sales',
    description: 'Verifies that Gross Ticket Sales are positive and non-zero.',
    status: salesPassed ? 'passed' : 'failed',
    actualValue: `$${(grossSales / 1e6).toFixed(1)}M`,
    expectedValue: '> 0',
    details: salesPassed 
      ? `Gross Ticket Sales is properly initialized at $${(grossSales / 1e6).toFixed(1)}M.`
      : `Warning: Gross Ticket Sales is $${grossSales}. Data may be empty or corrupted.`
  });

  // Rule B: Debit Prize Expense Signage
  const prizesPassed = prizeExpense <= 0;
  results.push({
    id: 'val-rule-prizes',
    name: 'Prize Expense Debit Signage',
    description: 'Confirms that Prize Expense is mapped as a debit balance (less than or equal to 0).',
    status: prizesPassed ? 'passed' : 'failed',
    actualValue: `$${(prizeExpense / 1e6).toFixed(1)}M`,
    expectedValue: '<= 0',
    details: prizesPassed
      ? `Prize Expense is correctly normal-signed at $${(prizeExpense / 1e6).toFixed(1)}M.`
      : `Violation: Prize Expense is positive ($${prizeExpense}). Signage must be normalized to negative.`
  });

  // Rule C: Retailer Commissions percentage checks (5% sales, 1% tolerance)
  const expectedCommPct = 0.05;
  const tolerance = 0.01;
  const actualRatio = grossSales > 0 ? Math.abs(commissions) / grossSales : 0;
  const dev = Math.abs(actualRatio - expectedCommPct);
  const commPassed = dev <= tolerance;

  results.push({
    id: 'val-rule-commissions',
    name: 'Retailer Commissions Reconciliation',
    description: 'Ensures retailer commissions are reconciled to approximately 5.0% of Gross Ticket Sales.',
    status: commPassed ? 'passed' : 'warning',
    actualValue: `${(actualRatio * 100).toFixed(2)}%`,
    expectedValue: '5.00% ± 1.0%',
    details: commPassed
      ? `Retailer Commissions reconcile properly at ${(actualRatio * 100).toFixed(2)}% of Gross Sales.`
      : `Anomalous Rate: Commissions are ${(actualRatio * 100).toFixed(2)}% of Gross Ticket Sales. Variance exceeds 1.0% policy tolerance.`
  });

  return results;
}
