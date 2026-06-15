import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { acquireLock, releaseLock } from "@/lib/jobLock";

export const dynamic = "force-dynamic";

const LICENSED_BRANDS = [
  { id: 'monopoly', name: 'Monopoly', vendorId: 'sg', feeType: 'percent', feeValue: 1.5 },
  { id: 'nfl', name: 'NFL', vendorId: 'sg', feeType: 'flat', feeValue: 250000 },
  { id: 'pacman', name: 'Pac-Man', vendorId: 'sg', feeType: 'perThousand', feeValue: 0.15 },
  { id: 'frogger', name: 'Frogger', vendorId: 'pb', feeType: 'percent', feeValue: 1.2 },
  { id: 'tetris', name: 'Tetris', vendorId: 'pb', feeType: 'perThousand', feeValue: 0.10 },
  { id: 'wheeloffortune', name: 'Wheel of Fortune', vendorId: 'igt', feeType: 'percent', feeValue: 2.0 }
];

const DEFAULT_FEATURE_RATES = {
  sg: { "Holographic Foil": 0.45, "Metallic Ink": 0.15, "Extended Play (Crossword/Bingo)": 0.25, "Die-Cut Ticket": 0.60, "Sparkle/Glitter Coating": 0.25, "Oversized Format": 0.35 },
  pb: { "Holographic Foil": 0.40, "Metallic Ink": 0.12, "Extended Play (Crossword/Bingo)": 0.20, "Die-Cut Ticket": 0.55, "Sparkle/Glitter Coating": 0.20, "Oversized Format": 0.30 },
  igt: { "Holographic Foil": 0.42, "Metallic Ink": 0.14, "Extended Play (Crossword/Bingo)": 0.22, "Die-Cut Ticket": 0.58, "Sparkle/Glitter Coating": 0.22, "Oversized Format": 0.32 }
};

export async function POST(request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const fy = parseInt(searchParams.get("fiscalYear") || "2027", 10);

  let jurisdictionId = session.user?.jurisdictionId;
  if (!jurisdictionId) {
    const defaultJur = await prisma.jurisdiction.findFirst({ where: { abbreviation: "NY" } });
    jurisdictionId = defaultJur?.id;
  }

  // Acquire lock
  const lockKey = `sync-budget-${jurisdictionId}-${fy}`;
  const lockResult = await acquireLock(
    lockKey,
    session.user.id || 'system',
    session.user.name || 'System',
    `Master Budget Rollup FY${fy}`,
    60
  );

  if (!lockResult.success) {
    return NextResponse.json(
      { error: `A job is currently running on the server: ${lockResult.activeLock.description} started by ${lockResult.activeLock.userName}.` },
      { status: 429 }
    );
  }

  // Fire-and-forget background execution
  Promise.resolve().then(async () => {
    try {
      // 1. Fetch Approved Divisional Budget Proposals
      const approvedProposals = await prisma.budgetProposal.findMany({
        where: { jurisdictionId, fiscalYear: fy, status: "approved" }
      });

      const divisionBudgets = {};
      let totalDivisionalExpense = 0;

      for (const prop of approvedProposals) {
        const items = Array.isArray(prop.proposalData) ? prop.proposalData : [];
        const sum = items.reduce((acc, curr) => acc + parseFloat(curr.amount || 0), 0);
        const key = `total_divisional_budget_${prop.division.toLowerCase()}`;
        divisionBudgets[key] = (divisionBudgets[key] || 0) + sum;
        totalDivisionalExpense += sum;
      }

      // Ensure all divisions are represented even if they don't have an approved proposal yet
      const divisions = ["it", "marketing", "operations", "procurement", "finance"];
      for (const div of divisions) {
        const key = `total_divisional_budget_${div}`;
        if (divisionBudgets[key] === undefined) {
          divisionBudgets[key] = 0;
        }
      }
      let activePlan = await prisma.instantTicketPlan.findFirst({
        where: { jurisdictionId, fiscalYear: fy },
        include: {
          scenarios: {
            where: { name: "Base Plan" }, // seed default
            include: {
              games: {
                include: {
                  features: true,
                  vendor: { select: { name: true } }
                }
              },
              marketingItems: true
            }
          }
        }
      });

      // Fallback: If no "Base Plan" scenario is found, fetch the first available scenario
      if (activePlan && (!activePlan.scenarios || activePlan.scenarios.length === 0)) {
        activePlan = await prisma.instantTicketPlan.findFirst({
          where: { jurisdictionId, fiscalYear: fy },
          include: {
            scenarios: {
              orderBy: { sortOrder: "asc" },
              take: 1,
              include: {
                games: {
                  include: {
                    features: true,
                    vendor: { select: { name: true } }
                  }
                },
                marketingItems: true
              }
            }
          }
        });
      }
      let totalScratcherSales = 0;
      let totalScratcherPrizeExpense = 0;
      let totalScratcherRetailerComm = 0;
      let totalScratcherPrintingCost = 0;
      let totalScratcherMarketingCost = 0;
      let totalScratcherSystemFee = 0;
      let totalScratcherRetailerBonus = 0;
      let totalScratcherCashingBonus = 0;
      let totalScratcherJackpotBonus = 0;
      let totalScratcherFixedOperating = 0;

      if (activePlan && activePlan.scenarios.length > 0) {
        const scenario = activePlan.scenarios[0];
        const sellThrough = parseFloat(activePlan.sellThroughPct) / 100.0;
        const retailerCommPct = parseFloat(activePlan.retailerCommPct) / 100.0;

        // Calculate Scratcher games metrics
        for (const game of scenario.games) {
          const units = Number(game.units);
          const denom = parseFloat(game.denomination);
          const payout = parseFloat(game.payoutPercent) / 100.0;

          const grossSales = units * denom * sellThrough;
          const prizeExpense = grossSales * payout;
          const retailerComm = grossSales * retailerCommPct;
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
            // Fetch all pricing tiers for the vendor and ticket size
            const pricingTiers = await prisma.instantTicketVendorPricing.findMany({
              where: { vendorId, ticketSize: size }
            });

            if (pricingTiers && pricingTiers.length > 0) {
              // Find matching tier by minQuantity descending
              const sortedTiers = [...pricingTiers].sort((a, b) => Number(b.minQuantity) - Number(a.minQuantity));
              const matchingTier = sortedTiers.find(t => units >= Number(t.minQuantity)) || sortedTiers[sortedTiers.length - 1];

              let baseCost = parseFloat(matchingTier.baseCost);
              defaultSystem = matchingTier.gamingSystemPercent !== undefined && matchingTier.gamingSystemPercent !== null ? parseFloat(matchingTier.gamingSystemPercent) : 2.50;
              defaultBonus = matchingTier.retailerBonusPercent !== undefined && matchingTier.retailerBonusPercent !== null ? parseFloat(matchingTier.retailerBonusPercent) : 0.50;
              defaultFixed = matchingTier.fixedOperatingCost !== undefined && matchingTier.fixedOperatingCost !== null ? parseFloat(matchingTier.fixedOperatingCost) : 0.00;
              defaultCashing = matchingTier.retailerCashingPercent !== undefined && matchingTier.retailerCashingPercent !== null ? parseFloat(matchingTier.retailerCashingPercent) : 1.00;
              defaultCashable = matchingTier.cashablePrizePercent !== undefined && matchingTier.cashablePrizePercent !== null ? parseFloat(matchingTier.cashablePrizePercent) : 70.00;
              defaultJackpot = matchingTier.jackpotBonusPercent !== undefined && matchingTier.jackpotBonusPercent !== null ? parseFloat(matchingTier.jackpotBonusPercent) : 0.50;
              defaultEligible = matchingTier.jackpotEligiblePercent !== undefined && matchingTier.jackpotEligiblePercent !== null ? parseFloat(matchingTier.jackpotEligiblePercent) : 10.00;
              defaultJackpotCap = matchingTier.jackpotBonusCap !== undefined && matchingTier.jackpotBonusCap !== null ? parseFloat(matchingTier.jackpotBonusCap) : 1000000.00;
              const reorderModel = matchingTier.reorderModel || 'none';
              const reorderValue = parseFloat(matchingTier.reorderValue || 0);

              // Apply reorder rules
              if (game.isReorder) {
                if (reorderModel === 'percent') {
                  baseCost = baseCost * (1 - reorderValue / 100.0);
                } else if (reorderModel === 'flatDiscount') {
                  baseCost = Math.max(0, baseCost - reorderValue);
                } else if (reorderModel === 'fixedRate') {
                  baseCost = reorderValue;
                }
              }

              // Apply cost model (percent of sales vs per thousand)
              if (matchingTier.costModel === "percent_of_sales") {
                printCost = (units * denom) * (baseCost / 100.0);
              } else {
                printCost = (units / 1000.0) * baseCost;
              }
            } else {
              printCost = (units / 1000.0) * 22.00;
            }
          } else {
            printCost = (units / 1000.0) * 22.00;
          }

          // Calculate features cost
          let vKey = 'sg';
          if (game.vendor?.name) {
            const name = game.vendor.name.toLowerCase();
            if (name.includes('scientific')) vKey = 'sg';
            else if (name.includes('pollard')) vKey = 'pb';
            else if (name.includes('igt') || name.includes('game tech') || name.includes('brightstar')) vKey = 'igt';
          }
          const featureRates = DEFAULT_FEATURE_RATES[vKey] || {};
          const gameFeatureCost = (game.features || []).reduce((sum, f) => {
            const rate = featureRates[f.featureName] || 0;
            return sum + (units / 1000.0) * rate;
          }, 0);
          printCost += gameFeatureCost;

          // Calculate licensed brand cost
          if (game.licensedBrandId) {
            const brandObj = LICENSED_BRANDS.find(b => b.id === game.licensedBrandId);
            if (brandObj) {
              let licenseCost = 0;
              if (brandObj.feeType === 'percent') {
                licenseCost = grossSales * (brandObj.feeValue / 100.0);
              } else if (brandObj.feeType === 'flat') {
                licenseCost = brandObj.feeValue;
              } else if (brandObj.feeType === 'perThousand') {
                licenseCost = (units / 1000.0) * brandObj.feeValue;
              }
              printCost += licenseCost;
            }
          }

          const systemPercent = game.gamingSystemPercent !== null && game.gamingSystemPercent !== undefined ? parseFloat(game.gamingSystemPercent) : defaultSystem;
          const bonusPercent = game.retailerBonusPercent !== null && game.retailerBonusPercent !== undefined ? parseFloat(game.retailerBonusPercent) : defaultBonus;
          const fixedCost = game.fixedOperatingCost !== null && game.fixedOperatingCost !== undefined ? parseFloat(game.fixedOperatingCost) : defaultFixed;
          const cashingPercent = game.retailerCashingPercent !== null && game.retailerCashingPercent !== undefined ? parseFloat(game.retailerCashingPercent) : defaultCashing;
          const cashableShare = game.cashablePrizePercent !== null && game.cashablePrizePercent !== undefined ? parseFloat(game.cashablePrizePercent) : defaultCashable;
          const jackpotPercent = game.jackpotBonusPercent !== null && game.jackpotBonusPercent !== undefined ? parseFloat(game.jackpotBonusPercent) : defaultJackpot;
          const jackpotEligible = game.jackpotEligiblePercent !== null && game.jackpotEligiblePercent !== undefined ? parseFloat(game.jackpotEligiblePercent) : defaultEligible;
          const jackpotCap = game.jackpotBonusCap !== null && game.jackpotBonusCap !== undefined ? parseFloat(game.jackpotBonusCap) : defaultJackpotCap;

          const systemFeeAmt = (grossSales * systemPercent) / 100;
          const retailerBonusAmt = (grossSales * bonusPercent) / 100;
          const cashingBonusAmt = prizeExpense * (cashableShare / 100) * (cashingPercent / 100);
          const jackpotBonusAmt = Math.min(jackpotCap, prizeExpense * (jackpotEligible / 100) * (jackpotPercent / 100));

          totalScratcherSystemFee += systemFeeAmt;
          totalScratcherRetailerBonus += retailerBonusAmt;
          totalScratcherCashingBonus += cashingBonusAmt;
          totalScratcherJackpotBonus += jackpotBonusAmt;
          totalScratcherFixedOperating += fixedCost;

          totalScratcherSales += grossSales;
          totalScratcherPrizeExpense += prizeExpense;
          totalScratcherRetailerComm += retailerComm;
          totalScratcherPrintingCost += printCost;
        }

        for (const item of scenario.marketingItems) {
          totalScratcherMarketingCost += parseFloat(item.cost);
        }
      }

      // 3. Fetch Approved Draw Game Projections
      const drawScenario = await prisma.drawGameScenario.findFirst({
        where: { jurisdictionId, fiscalYear: fy },
        include: { games: true }
      });

      let totalDrawSales = 0;
      let totalDrawPrizeExpense = 0;
      let totalDrawRetailerComm = 0;
      let totalDrawSystemFee = 0;
      let totalDrawRetailerBonus = 0;
      let totalDrawCashingBonus = 0;
      let totalDrawJackpotBonus = 0;
      let totalDrawFixedOperating = 0;

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
          const systemFeeAmt = (sales * systemPercent) / 100;
          const retailerBonusAmt = (sales * bonusPercent) / 100;
          const cashingBonusAmt = prizePayoutAmt * (cashableShare / 100) * (cashingPercent / 100);
          const jackpotBonusAmt = Math.min(jackpotCap, prizePayoutAmt * (jackpotEligible / 100) * (jackpotPercent / 100));

          totalDrawSales += sales;
          totalDrawPrizeExpense += prizePayoutAmt;
          totalDrawRetailerComm += sales * comm;
          totalDrawSystemFee += systemFeeAmt;
          totalDrawRetailerBonus += retailerBonusAmt;
          totalDrawCashingBonus += cashingBonusAmt;
          totalDrawJackpotBonus += jackpotBonusAmt;
          totalDrawFixedOperating += fixedCost;
        }
      }

      // 4. Compile into Unified Budget object
      const budgetData = {
        ...divisionBudgets,
        total_scratch_off_sales: totalScratcherSales,
        total_scratch_off_prize_expense: totalScratcherPrizeExpense,
        total_scratch_off_retailer_comm: totalScratcherRetailerComm,
        total_scratch_off_printing_cost: totalScratcherPrintingCost,
        total_scratch_off_marketing_cost: totalScratcherMarketingCost,
        total_scratch_off_system_fee: totalScratcherSystemFee,
        total_scratch_off_retailer_bonus: totalScratcherRetailerBonus,
        total_scratch_off_retailer_cashing_bonus: totalScratcherCashingBonus,
        total_scratch_off_retailer_jackpot_bonus: totalScratcherJackpotBonus,
        total_scratch_off_fixed_operating: totalScratcherFixedOperating,
        total_draw_game_sales: totalDrawSales,
        total_draw_game_prize_expense: totalDrawPrizeExpense,
        total_draw_game_retailer_comm: totalDrawRetailerComm,
        total_draw_game_system_fee: totalDrawSystemFee,
        total_draw_game_retailer_bonus: totalDrawRetailerBonus,
        total_draw_game_retailer_cashing_bonus: totalDrawCashingBonus,
        total_draw_game_retailer_jackpot_bonus: totalDrawJackpotBonus,
        total_draw_game_fixed_operating: totalDrawFixedOperating,
        total_divisional_expense: totalDivisionalExpense,
        total_projected_net_revenue: (totalScratcherSales + totalDrawSales) - (
          totalScratcherPrizeExpense + totalDrawPrizeExpense + 
          totalScratcherRetailerComm + totalDrawRetailerComm + 
          totalScratcherPrintingCost + totalScratcherMarketingCost + 
          totalScratcherSystemFee + totalScratcherRetailerBonus + totalScratcherCashingBonus + totalScratcherJackpotBonus + totalScratcherFixedOperating +
          totalDrawSystemFee + totalDrawRetailerBonus + totalDrawCashingBonus + totalDrawJackpotBonus + totalDrawFixedOperating +
          totalDivisionalExpense
        )
      };

      // 5. Update or Create ReportPackage and BudgetScenario
      let reportPackage = await prisma.reportPackage.findFirst({
        where: { jurisdictionId, periodDate: new Date(`${fy}-04-01`), frequency: "annual" }
      });

      if (!reportPackage) {
        reportPackage = await prisma.reportPackage.create({
          data: {
            jurisdictionId,
            name: `FY${fy} Annual Budget Package`,
            frequency: "annual",
            periodDate: new Date(`${fy}-04-01`),
            status: "draft",
            createdById: session.user.id
          }
        });
      }

      let budgetScenario = await prisma.budgetScenario.findFirst({
        where: { packageId: reportPackage.id, name: "Adopted Budget Plan" }
      });

      if (budgetScenario) {
        await prisma.budgetScenario.update({
          where: { id: budgetScenario.id },
          data: {
            data: budgetData,
            status: "adopted",
            isAdopted: true
          }
        });
      } else {
        await prisma.budgetScenario.create({
          data: {
            packageId: reportPackage.id,
            name: "Adopted Budget Plan",
            status: "adopted",
            isAdopted: true,
            data: budgetData
          }
        });
      }
    } catch (err) {
      console.error("Failed to compile background budget rollup:", err);
    } finally {
      await releaseLock(lockKey);
    }
  });

  return NextResponse.json({
    success: true,
    message: "Master budget consolidation rollup task successfully dispatched in the background."
  }, { status: 202 });
}

