import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";
import { acquireLock, releaseLock } from "@/lib/jobLock";

export const dynamic = "force-dynamic";

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

      // 2. Fetch Approved Instant Ticket Planning Aggregates
      let activePlan = await prisma.instantTicketPlan.findFirst({
        where: { jurisdictionId, fiscalYear: fy },
        include: {
          scenarios: {
            where: { name: "Base Plan" }, // seed default
            include: {
              games: true,
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
                games: true,
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

      // 4. Compile into Unified Budget object
      const budgetData = {
        ...divisionBudgets,
        total_scratch_off_sales: totalScratcherSales,
        total_scratch_off_prize_expense: totalScratcherPrizeExpense,
        total_scratch_off_retailer_comm: totalScratcherRetailerComm,
        total_scratch_off_printing_cost: totalScratcherPrintingCost,
        total_scratch_off_marketing_cost: totalScratcherMarketingCost,
        total_draw_game_sales: totalDrawSales,
        total_draw_game_prize_expense: totalDrawPrizeExpense,
        total_draw_game_retailer_comm: totalDrawRetailerComm,
        total_divisional_expense: totalDivisionalExpense,
        total_projected_net_revenue: (totalScratcherSales + totalDrawSales) - (totalScratcherPrizeExpense + totalDrawPrizeExpense + totalScratcherRetailerComm + totalDrawRetailerComm + totalScratcherPrintingCost + totalScratcherMarketingCost + totalDivisionalExpense)
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

