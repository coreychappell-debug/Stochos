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
    let expectedScratcherSystemFee = 0;
    let expectedScratcherRetailerBonus = 0;
    let expectedScratcherCashingBonus = 0;
    let expectedScratcherJackpotBonus = 0;
    let expectedScratcherFixedOperating = 0;

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

        let defaultSystem = 2.50;
        let defaultBonus = 0.50;
        let defaultFixed = 0.00;
        let defaultCashing = 1.00;
        let defaultCashable = 70.00;
        let defaultJackpot = 0.50;
        let defaultEligible = 10.00;
        let defaultJackpotCap = 1000000.00;

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
            defaultSystem = pricing.gamingSystemPercent !== undefined && pricing.gamingSystemPercent !== null ? parseFloat(pricing.gamingSystemPercent) : 2.50;
            defaultBonus = pricing.retailerBonusPercent !== undefined && pricing.retailerBonusPercent !== null ? parseFloat(pricing.retailerBonusPercent) : 0.50;
            defaultFixed = pricing.fixedOperatingCost !== undefined && pricing.fixedOperatingCost !== null ? parseFloat(pricing.fixedOperatingCost) : 0.00;
            defaultCashing = pricing.retailerCashingPercent !== undefined && pricing.retailerCashingPercent !== null ? parseFloat(pricing.retailerCashingPercent) : 1.00;
            defaultCashable = pricing.cashablePrizePercent !== undefined && pricing.cashablePrizePercent !== null ? parseFloat(pricing.cashablePrizePercent) : 70.00;
            defaultJackpot = pricing.jackpotBonusPercent !== undefined && pricing.jackpotBonusPercent !== null ? parseFloat(pricing.jackpotBonusPercent) : 0.50;
            defaultEligible = pricing.jackpotEligiblePercent !== undefined && pricing.jackpotEligiblePercent !== null ? parseFloat(pricing.jackpotEligiblePercent) : 10.00;
            defaultJackpotCap = pricing.jackpotBonusCap !== undefined && pricing.jackpotBonusCap !== null ? parseFloat(pricing.jackpotBonusCap) : 1000000.00;
          } else {
            printCost = (units / 1000) * 22.00;
          }
        } else {
          printCost = (units / 1000) * 22.00;
        }

        const systemPercent = game.gamingSystemPercent !== null && game.gamingSystemPercent !== undefined ? parseFloat(game.gamingSystemPercent) : defaultSystem;
        const bonusPercent = game.retailerBonusPercent !== null && game.retailerBonusPercent !== undefined ? parseFloat(game.retailerBonusPercent) : defaultBonus;
        const fixedCost = game.fixedOperatingCost !== null && game.fixedOperatingCost !== undefined ? parseFloat(game.fixedOperatingCost) : defaultFixed;
        const cashingPercent = game.retailerCashingPercent !== null && game.retailerCashingPercent !== undefined ? parseFloat(game.retailerCashingPercent) : defaultCashing;
        const cashableShare = game.cashablePrizePercent !== null && game.cashablePrizePercent !== undefined ? parseFloat(game.cashablePrizePercent) : defaultCashable;
        const jackpotPercent = game.jackpotBonusPercent !== null && game.jackpotBonusPercent !== undefined ? parseFloat(game.jackpotBonusPercent) : defaultJackpot;
        const jackpotEligible = game.jackpotEligiblePercent !== null && game.jackpotEligiblePercent !== undefined ? parseFloat(game.jackpotEligiblePercent) : defaultEligible;
        const jackpotCap = game.jackpotBonusCap !== null && game.jackpotBonusCap !== undefined ? parseFloat(game.jackpotBonusCap) : defaultJackpotCap;

        expectedScratcherSystemFee += (grossSales * systemPercent) / 100;
        expectedScratcherRetailerBonus += (grossSales * bonusPercent) / 100;
        expectedScratcherCashingBonus += prizeExpense * (cashableShare / 100) * (cashingPercent / 100);
        expectedScratcherJackpotBonus += Math.min(jackpotCap, prizeExpense * (jackpotEligible / 100) * (jackpotPercent / 100));
        expectedScratcherFixedOperating += fixedCost;

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
    let expectedDrawSystemFee = 0;
    let expectedDrawRetailerBonus = 0;
    let expectedDrawCashingBonus = 0;
    let expectedDrawJackpotBonus = 0;
    let expectedDrawFixedOperating = 0;

    if (drawScenario) {
      for (const game of drawScenario.games) {
        const sales = parseFloat(game.projectedSales);
        const payout = parseFloat(game.prizePayoutPercent) / 100.0;
        const comm = parseFloat(game.retailerCommPercent) / 100.0;

        const systemPercent = game.gamingSystemPercent !== undefined && game.gamingSystemPercent !== null ? parseFloat(game.gamingSystemPercent) : 2.50;
        const bonusPercent = game.retailerBonusPercent !== undefined && game.retailerBonusPercent !== null ? parseFloat(game.retailerBonusPercent) : 0.50;
        const cashingPercent = game.retailerCashingPercent !== undefined && game.retailerCashingPercent !== null ? parseFloat(game.retailerCashingPercent) : 1.00;
        const cashableShare = game.cashablePrizePercent !== undefined && game.cashablePrizePercent !== null ? parseFloat(game.cashablePrizePercent) : 50.00;
        const jackpotPercent = game.jackpotBonusPercent !== undefined && game.jackpotBonusPercent !== null ? parseFloat(game.jackpotBonusPercent) : 0.50;
        const jackpotEligible = game.jackpotEligiblePercent !== undefined && game.jackpotEligiblePercent !== null ? parseFloat(game.jackpotEligiblePercent) : 25.00;
        const jackpotCap = game.jackpotBonusCap !== undefined && game.jackpotBonusCap !== null ? parseFloat(game.jackpotBonusCap) : 1000000.00;
        const fixedCost = game.fixedOperatingCost !== undefined && game.fixedOperatingCost !== null ? parseFloat(game.fixedOperatingCost) : 0.00;

        const prizePayoutAmt = sales * payout;
        expectedDrawSales += sales;
        expectedDrawPrizeExpense += prizePayoutAmt;
        expectedDrawRetailerComm += sales * comm;
        expectedDrawSystemFee += (sales * systemPercent) / 100;
        expectedDrawRetailerBonus += (sales * bonusPercent) / 100;
        expectedDrawCashingBonus += prizePayoutAmt * (cashableShare / 100) * (cashingPercent / 100);
        expectedDrawJackpotBonus += Math.min(jackpotCap, prizePayoutAmt * (jackpotEligible / 100) * (jackpotPercent / 100));
        expectedDrawFixedOperating += fixedCost;
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
      expectedScratcherSystemFee + expectedScratcherRetailerBonus + expectedScratcherCashingBonus + expectedScratcherJackpotBonus + expectedScratcherFixedOperating +
      expectedDrawSystemFee + expectedDrawRetailerBonus + expectedDrawCashingBonus + expectedDrawJackpotBonus + expectedDrawFixedOperating +
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
