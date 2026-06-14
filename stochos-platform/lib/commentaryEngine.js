import { prisma } from './db.js';

// Helper to map metric ID to responsible division
function getAssignedDivision(metricId) {
  if (metricId === 'sys-001') return 'MARKETING';
  if (metricId === 'sys-004') return 'OPERATIONS';
  if (metricId === 'sys-007') return 'MARKETING';
  return 'FINANCE'; // default
}

// Compute actual value from trial balance records
function getActualVal(metricId, records, metricGlMap) {
  let sum = 0;
  for (const r of records) {
    const code = r.accountCode || '';
    const val = parseFloat(r.balance.toString());
    if (metricId === 'sys-001') {
      if (code === '4-1000' || code.startsWith('40000') || code.startsWith('40100')) {
        sum += val;
      }
    } else if (metricId === 'sys-002') {
      if (code === '5-2000' || code.startsWith('6410')) {
        sum += val;
      }
    } else if (metricId === 'sys-003') {
      if (code === '5-2100' || code.startsWith('6420')) {
        sum += val;
      }
    } else {
      if (code === metricGlMap[metricId]) {
        sum += val;
      }
    }
  }
  return sum;
}

// Retrieve budget value for the metric
function getBudgetVal(metricId, budgetData) {
  if (!budgetData) return 0;
  if (metricId === 'sys-001') {
    return (parseFloat(budgetData.total_scratch_off_sales) || 0) + (parseFloat(budgetData.total_draw_game_sales) || 0);
  }
  if (metricId === 'sys-002') {
    return (parseFloat(budgetData.total_scratch_off_prize_expense) || 0) + (parseFloat(budgetData.total_draw_game_prize_expense) || 0);
  }
  if (metricId === 'sys-003') {
    return (parseFloat(budgetData.total_scratch_off_retailer_comm) || 0) + (parseFloat(budgetData.total_draw_game_retailer_comm) || 0);
  }
  // Fallback division budgets keys
  const divName = getAssignedDivision(metricId).toLowerCase();
  const key = `total_divisional_budget_${divName}`;
  if (budgetData[key] !== undefined) {
    return parseFloat(budgetData[key]) || 0;
  }
  return 0;
}

// Compute adopted budget plan data dynamically if not synced yet
async function getAdoptedBudgetData(jurisdictionId, fy, pkgId) {
  // 1. Try to find existing Adopted Budget Plan
  const scenario = await prisma.budgetScenario.findFirst({
    where: { packageId: pkgId, name: 'Adopted Budget Plan' }
  });
  if (scenario && scenario.data) {
    return scenario.data;
  }

  // 2. Query and aggregate on the fly (fallback)
  const approvedProposals = await prisma.budgetProposal.findMany({
    where: { jurisdictionId, fiscalYear: fy, status: 'approved' }
  });
  let totalDivisionalExpense = 0;
  const divisionBudgets = {};
  for (const prop of approvedProposals) {
    const items = Array.isArray(prop.proposalData) ? prop.proposalData : [];
    const sum = items.reduce((acc, curr) => acc + parseFloat(curr.amount || 0), 0);
    const key = `total_divisional_budget_${prop.division.toLowerCase()}`;
    divisionBudgets[key] = (divisionBudgets[key] || 0) + sum;
    totalDivisionalExpense += sum;
  }

  let activePlan = await prisma.instantTicketPlan.findFirst({
    where: { jurisdictionId, fiscalYear: fy },
    include: {
      scenarios: {
        where: { name: 'Base Plan' },
        include: { games: true, marketingItems: true }
      }
    }
  });

  // Fallback: If no scenario is named "Base Plan", grab the first available scenario
  if (activePlan && (!activePlan.scenarios || activePlan.scenarios.length === 0)) {
    activePlan = await prisma.instantTicketPlan.findFirst({
      where: { jurisdictionId, fiscalYear: fy },
      include: {
        scenarios: {
          orderBy: { sortOrder: 'asc' },
          take: 1,
          include: { games: true, marketingItems: true }
        }
      }
    });
  }
  let totalScratcherSales = 0;
  let totalScratcherPrizeExpense = 0;
  let totalScratcherRetailerComm = 0;
  if (activePlan && activePlan.scenarios.length > 0) {
    const sc = activePlan.scenarios[0];
    const sellThrough = parseFloat(activePlan.sellThroughPct) / 100.0;
    const retailerCommPct = parseFloat(activePlan.retailerCommPct) / 100.0;
    for (const game of sc.games) {
      const units = Number(game.units);
      const denom = parseFloat(game.denomination);
      const payout = parseFloat(game.payoutPercent) / 100.0;
      const sales = units * denom * sellThrough;
      totalScratcherSales += sales;
      totalScratcherPrizeExpense += sales * payout;
      totalScratcherRetailerComm += sales * retailerCommPct;
    }
  }

  const drawScenario = await prisma.drawGameScenario.findFirst({
    where: { jurisdictionId, fiscalYear: fy },
    include: { games: true }
  });
  let totalDrawSales = 0;
  let totalDrawPrizeExpense = 0;
  let totalDrawRetailerComm = 0;
  if (drawScenario) {
    for (const game of drawScenario.games) {
      const sales = parseFloat(game.projectedSales);
      const payout = parseFloat(game.prizePayoutPercent) / 100.0;
      const comm = parseFloat(game.retailerCommPercent) / 100.0;
      totalDrawSales += sales;
      totalDrawPrizeExpense += sales * payout;
      totalDrawRetailerComm += sales * comm;
    }
  }

  return {
    ...divisionBudgets,
    total_scratch_off_sales: totalScratcherSales,
    total_scratch_off_prize_expense: totalScratcherPrizeExpense,
    total_scratch_off_retailer_comm: totalScratcherRetailerComm,
    total_draw_game_sales: totalDrawSales,
    total_draw_game_prize_expense: totalDrawPrizeExpense,
    total_draw_game_retailer_comm: totalDrawRetailerComm,
    total_divisional_expense: totalDivisionalExpense
  };
}

export async function evaluateCommentaryRules(uploadBatchId) {
  try {
    console.log(`🤖 Starting commentary rule evaluation for batch ${uploadBatchId}...`);

    // 1. Fetch the batch details
    const batch = await prisma.importBatch.findUnique({
      where: { id: uploadBatchId }
    });

    if (!batch || batch.status !== 'complete') {
      console.warn(`⚠️ Batch ${uploadBatchId} not found or not complete. Skipping.`);
      return;
    }

    const { jurisdictionId, periodDate: periodDateStr } = batch.mappingSnapshot || {};
    if (!jurisdictionId || !periodDateStr) {
      console.warn(`⚠️ Batch ${uploadBatchId} mapping snapshot is incomplete. Skipping.`);
      return;
    }

    // 2. Find or create the ReportPackage
    const reportDate = new Date(`${batch.fiscalYear}-04-01`);
    let pkg = await prisma.reportPackage.findFirst({
      where: {
        jurisdictionId,
        periodDate: reportDate,
        frequency: 'annual'
      },
      include: {
        sections: true
      }
    });

    if (!pkg) {
      const user = await prisma.user.findFirst({
        where: { name: batch.uploadedBy }
      }) || await prisma.user.findFirst();

      if (!user) {
        console.warn('❌ Cannot create report package: no user found in database.');
        return;
      }

      pkg = await prisma.reportPackage.create({
        data: {
          jurisdictionId,
          name: `FY${batch.fiscalYear} Annual Report Package`,
          frequency: 'annual',
          periodDate: reportDate,
          status: 'draft',
          createdById: user.id
        },
        include: {
          sections: true
        }
      });
      console.log(`✓ Created report package: ${pkg.name}`);
    }

    // 3. Ensure child sections exist
    let sections = pkg.sections || [];
    if (sections.length === 0) {
      const defaultSections = [
        { name: 'Letter of Transmittal', sortOrder: 1, dueDateOffsetDays: 45 },
        { name: 'Management Discussion & Analysis (MD&A)', sortOrder: 2, dueDateOffsetDays: 50 },
        { name: 'Statement of Net Position', sortOrder: 3, dueDateOffsetDays: 55 },
        { name: 'Notes to Financial Statements', sortOrder: 4, dueDateOffsetDays: 60 }
      ];
      const getDueDate = (offsetDays) => {
        const d = new Date(pkg.periodDate);
        d.setDate(d.getDate() + offsetDays);
        return d;
      };
      const sectionsData = defaultSections.map((sec) => ({
        packageId: pkg.id,
        name: sec.name,
        content: `<h2>${sec.name}</h2><p>Provide narrative details here.</p>`,
        status: 'draft',
        sortOrder: sec.sortOrder,
        dueDate: getDueDate(sec.dueDateOffsetDays)
      }));
      await prisma.reportSection.createMany({
        data: sectionsData
      });
      sections = await prisma.reportSection.findMany({
        where: { packageId: pkg.id }
      });
      console.log('✓ Created default report package sections');
    }

    // 4. Fetch the adopted budget plan data
    const budgetData = await getAdoptedBudgetData(jurisdictionId, batch.fiscalYear, pkg.id);

    // 5. Query the trial balance records for this batch
    const tbRecords = await prisma.trialBalanceRecord.findMany({
      where: { uploadId: batch.id }
    });

    // 6. Fetch all active commentary rules and metric definitions
    const rules = await prisma.commentaryRule.findMany({
      where: { isActive: true },
      include: { metric: true }
    });

    const metricGlMap = {};
    for (const r of rules) {
      if (r.metric) {
        metricGlMap[r.metric.id] = r.metric.glAccount;
      }
    }

    console.log(`Evaluating ${rules.length} active rules against ${tbRecords.length} records...`);

    // 7. Evaluate each rule
    for (const rule of rules) {
      const actualVal = getActualVal(rule.metricId, tbRecords, metricGlMap);
      const budgetVal = getBudgetVal(rule.metricId, budgetData);

      const absActual = Math.abs(actualVal);
      const absBudget = Math.abs(budgetVal);
      const variancePct = absBudget > 0 ? (absActual - absBudget) / absBudget : 0;

      const threshold = parseFloat(rule.threshold.toString());
      const diff = Math.abs(variancePct);
      let breached = false;

      if (rule.operator === '>') breached = diff > threshold;
      else if (rule.operator === '>=') breached = diff >= threshold;
      else if (rule.operator === '<') breached = diff < threshold;
      else if (rule.operator === '<=') breached = diff <= threshold;
      else if (rule.operator === '==') breached = diff === threshold;
      else if (rule.operator === '!=') breached = diff !== threshold;

      // Map rule appliesToSectionType to report section
      const section = sections.find(s => s.name.toLowerCase().includes(rule.appliesToSectionType.toLowerCase())) || sections[0];

      // Find existing task
      const existingTask = await prisma.commentaryTask.findFirst({
        where: {
          packageId: pkg.id,
          sectionId: section.id,
          ruleId: rule.id
        }
      });

      if (breached) {
        const severity = rule.severity >= 4 ? 'hard_fail' : (rule.severity === 3 ? 'soft_warning' : 'info');
        const metricSnapshot = {
          metricId: rule.metricId,
          metricName: rule.name,
          actualValue: actualVal,
          budgetValue: budgetVal,
          variancePct: parseFloat(variancePct.toFixed(4))
        };

        if (existingTask) {
          // If the task was already completed, but actuals updated and it is still breached,
          // let's reset it to pending so the user is forced to re-justify.
          await prisma.commentaryTask.update({
            where: { id: existingTask.id },
            data: {
              status: existingTask.status === 'completed' ? 'pending' : existingTask.status,
              severity,
              metricSnapshot
            }
          });
          console.log(`⚠️ Updated breach task for rule: ${rule.ruleCode} (Variance: ${(variancePct * 100).toFixed(2)}%)`);
        } else {
          await prisma.commentaryTask.create({
            data: {
              packageId: pkg.id,
              sectionId: section.id,
              ruleId: rule.id,
              ruleCode: rule.ruleCode,
              status: 'pending',
              assignedTo: getAssignedDivision(rule.metricId),
              severity,
              metricSnapshot
            }
          });
          console.log(`🚨 Triggered new breach task for rule: ${rule.ruleCode} (Variance: ${(variancePct * 100).toFixed(2)}%)`);
        }
      } else {
        // If not breached, but there is an existing task, delete/resolve it
        if (existingTask) {
          await prisma.commentaryTask.delete({
            where: { id: existingTask.id }
          });
          console.log(`✓ Cleaned up task for rule ${rule.ruleCode} since variance is within tolerance.`);
        }
      }
    }

    console.log('🎉 Commentary evaluation complete.');
  } catch (error) {
    console.error('❌ Error during commentary rule evaluation:', error);
  }
}
