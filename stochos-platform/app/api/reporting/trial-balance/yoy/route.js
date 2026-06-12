import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

// Wildcard matcher utility
function matchPattern(accountCode, pattern) {
  const escaped = pattern.replace(/[-\/\\^$*+?.()|[\]{}]/g, (char) => {
    if (char === '*') return '.*';
    return '\\' + char;
  });
  const regex = new RegExp(`^${escaped}$`);
  return regex.test(accountCode);
}

// Find matching rule with specificity sorting
function getMatchingRule(accountCode, rules) {
  const sortedRules = [...rules].sort((a, b) => {
    const aHasWildcard = a.accountPattern.includes('*');
    const bHasWildcard = b.accountPattern.includes('*');
    if (aHasWildcard && !bHasWildcard) return 1;
    if (!aHasWildcard && bHasWildcard) return -1;
    return b.accountPattern.length - a.accountPattern.length; // longer pattern first
  });

  for (const rule of sortedRules) {
    if (matchPattern(accountCode, rule.accountPattern)) {
      return rule;
    }
  }
  return null;
}

// Helper to aggregate records by metric
function aggregateMetrics(records, rules, metrics) {
  const metricSums = {};
  
  // Initialize sums
  metrics.forEach(m => {
    metricSums[m.id] = 0;
  });
  metricSums['unmapped'] = 0;

  records.forEach(record => {
    const balance = parseFloat(record.balance.toString());
    const rule = getMatchingRule(record.accountCode, rules);
    
    if (rule) {
      const multiplier = parseFloat(rule.signageMultiplier.toString());
      metricSums[rule.metricId] += balance * multiplier;
    } else {
      metricSums['unmapped'] += balance;
    }
  });

  return metricSums;
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const jurisdictionId = searchParams.get('jurisdictionId') || 'NY-LOTTERY';
    const fiscalYear = parseInt(searchParams.get('fiscalYear') || '2025', 10);
    const periodCode = searchParams.get('periodCode') || 'P03';

    // 1. Fetch system metrics and crosswalk rules
    const [metrics, rules] = await Promise.all([
      prisma.metricDefinition.findMany(),
      prisma.glCrosswalkRule.findMany({
        where: { jurisdictionId }
      })
    ]);

    // 2. Fetch records for current year and prior year
    const [currentRecords, priorRecords] = await Promise.all([
      prisma.trialBalanceRecord.findMany({
        where: {
          jurisdictionId,
          fiscalYear,
          periodCode
        }
      }),
      prisma.trialBalanceRecord.findMany({
        where: {
          jurisdictionId,
          fiscalYear: fiscalYear - 1,
          periodCode
        }
      })
    ]);

    // 3. Aggregate
    const currentSums = aggregateMetrics(currentRecords, rules, metrics);
    const priorSums = aggregateMetrics(priorRecords, rules, metrics);

    // 4. Build YoY output
    const comparison = metrics.map(m => {
      const current = currentSums[m.id] || 0;
      const prior = priorSums[m.id] || 0;
      const variance = current - prior;
      const percentChange = prior !== 0 ? (variance / Math.abs(prior)) * 100 : null;

      return {
        metricId: m.id,
        metricName: m.name,
        glAccount: m.glAccount,
        currentValue: current,
        priorValue: prior,
        variance,
        percentChange
      };
    });

    // Add unmapped if any
    const unmappedCurrent = currentSums['unmapped'] || 0;
    const unmappedPrior = priorSums['unmapped'] || 0;
    if (unmappedCurrent !== 0 || unmappedPrior !== 0) {
      const variance = unmappedCurrent - unmappedPrior;
      comparison.push({
        metricId: 'unmapped',
        metricName: 'Unmapped Accounts',
        glAccount: 'N/A',
        currentValue: unmappedCurrent,
        priorValue: unmappedPrior,
        variance,
        percentChange: unmappedPrior !== 0 ? (variance / Math.abs(unmappedPrior)) * 100 : null
      });
    }

    return NextResponse.json({
      success: true,
      fiscalYear,
      priorFiscalYear: fiscalYear - 1,
      periodCode,
      comparison
    });

  } catch (error) {
    console.error('Error generating YoY comparison:', error);
    return NextResponse.json({ error: 'Failed to generate YoY report', details: error.message }, { status: 500 });
  }
}
