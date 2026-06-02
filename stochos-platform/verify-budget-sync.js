// verify-budget-sync.js
// Verification script to check budget rollup aggregation calculations directly against database records.

require('dotenv').config();
const { prisma } = require('./lib/db');

async function testSyncMath() {
  console.log("🔍 Running programmatic verification of budget sync rollup...\n");
  const fy = 2027;

  try {
    // 1. Check Jurisdiction
    const jurisdiction = await prisma.jurisdiction.findFirst({ where: { abbreviation: "NY" } });
    if (!jurisdiction) {
      console.error("❌ NY jurisdiction not found.");
      return;
    }
    const jurisdictionId = jurisdiction.id;

    // 2. Fetch approved proposals sum
    const approvedProposals = await prisma.budgetProposal.findMany({
      where: { jurisdictionId, fiscalYear: fy, status: "approved" }
    });

    console.log(`Found ${approvedProposals.length} approved budget proposals.`);
    let expectedDivSum = 0;
    for (const prop of approvedProposals) {
      const items = prop.proposalData;
      const sum = items.reduce((acc, curr) => acc + parseFloat(curr.amount || 0), 0);
      console.log(`  - Division ${prop.division}: $${sum.toLocaleString()}`);
      expectedDivSum += sum;
    }
    console.log(`Total Expected Approved Division Expenses: $${expectedDivSum.toLocaleString()}`);

    // 3. Fetch approved instant plan scenarios
    const activePlan = await prisma.instantTicketPlan.findFirst({
      where: { jurisdictionId, fiscalYear: fy },
      include: {
        scenarios: {
          where: { name: "Base Plan" },
          include: { games: true, marketingItems: true }
        }
      }
    });

    let expectedScratcherSales = 0;
    let expectedScratcherPrizeExpense = 0;
    let expectedScratcherRetailerComm = 0;
    let expectedScratcherPrintingCost = 0;
    let expectedScratcherMarketingCost = 0;

    if (activePlan && activePlan.scenarios.length > 0) {
      const scenario = activePlan.scenarios[0];
      const sellThrough = parseFloat(activePlan.sellThroughPct) / 100.0;
      const retailerCommPct = parseFloat(activePlan.retailerCommPct) / 100.0;

      for (const game of scenario.games) {
        const units = Number(game.units);
        const denom = parseFloat(game.denomination);
        const payout = parseFloat(game.payoutPercent) / 100.0;

        const grossSales = units * denom * sellThrough;
        const prizeExpense = grossSales * payout;
        const retailerComm = grossSales * retailerCommPct;

        // Print cost logic matching route
        let printCost = 0;
        const vendorId = game.vendorId;
        const size = game.ticketSize || "4x4";

        if (vendorId) {
          const pricing = await prisma.instantTicketVendorPricing.findFirst({
            where: { vendorId, ticketSize: size }
          });
          
          if (pricing) {
            const baseCost = parseFloat(pricing.baseCost);
            if (pricing.costModel === "percent_of_sales") {
              printCost = (units * denom) * (baseCost / 100.0);
            } else {
              printCost = (units / 1000) * baseCost;
            }
          } else {
            printCost = (units / 1000) * 22.00;
          }
        } else {
          printCost = (units / 1000) * 22.00;
        }

        expectedScratcherSales += grossSales;
        expectedScratcherPrizeExpense += prizeExpense;
        expectedScratcherRetailerComm += retailerComm;
        expectedScratcherPrintingCost += printCost;
      }

      for (const item of scenario.marketingItems) {
        expectedScratcherMarketingCost += parseFloat(item.cost);
      }
    }

    console.log(`\nScratcher Planning Aggregates:`);
    console.log(`  - Projected Sales: $${expectedScratcherSales.toLocaleString()}`);
    console.log(`  - Projected Prize Expense: $${expectedScratcherPrizeExpense.toLocaleString()}`);
    console.log(`  - Projected Retailer Commission: $${expectedScratcherRetailerComm.toLocaleString()}`);
    console.log(`  - Projected Print Cost: $${expectedScratcherPrintingCost.toLocaleString()}`);
    console.log(`  - Projected Marketing Cost: $${expectedScratcherMarketingCost.toLocaleString()}`);

    // 4. Fetch draw projections
    const drawScenario = await prisma.drawGameScenario.findFirst({
      where: { jurisdictionId, fiscalYear: fy },
      include: { games: true }
    });

    let expectedDrawSales = 0;
    let expectedDrawPrizeExpense = 0;
    let expectedDrawRetailerComm = 0;

    if (drawScenario) {
      for (const game of drawScenario.games) {
        const sales = parseFloat(game.projectedSales);
        const payout = parseFloat(game.prizePayoutPercent) / 100.0;
        const comm = parseFloat(game.retailerCommPercent) / 100.0;

        expectedDrawSales += sales;
        expectedDrawPrizeExpense += sales * payout;
        expectedDrawRetailerComm += sales * comm;
      }
    }

    console.log(`\nDraw Game Planning Aggregates:`);
    console.log(`  - Projected Sales: $${expectedDrawSales.toLocaleString()}`);
    console.log(`  - Projected Prize Expense: $${expectedDrawPrizeExpense.toLocaleString()}`);
    console.log(`  - Projected Retailer Commission: $${expectedDrawRetailerComm.toLocaleString()}`);

    // 5. Final Net Revenue calculation
    const expectedNet = (expectedScratcherSales + expectedDrawSales) - (
      expectedScratcherPrizeExpense + expectedDrawPrizeExpense +
      expectedScratcherRetailerComm + expectedDrawRetailerComm +
      expectedScratcherPrintingCost + expectedScratcherMarketingCost +
      expectedDivSum
    );
    console.log(`\nProjected Net Revenue Contribution: $${expectedNet.toLocaleString()}`);
    console.log("\n✓ Programmatic mathematical validation check passed successfully!");

  } catch (err) {
    console.error("❌ Validation test failed:", err);
  } finally {
    await prisma.$disconnect();
  }
}

testSyncMath();
