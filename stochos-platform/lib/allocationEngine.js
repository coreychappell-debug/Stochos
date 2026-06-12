import { prisma } from "./db.js";

/**
 * Calculates shared expense allocations for an instant ticket plan.
 * Central contracts (overhead) are allocated proportionally:
 * 1. Proportional share between Instant and Draw games based on projected gross sales.
 * 2. Instant ticket share is allocated to individual instant games based on the selected basis:
 *    - 'sales': game gross sales / total instant gross sales
 *    - 'volume': game units / total instant units
 * 
 * @param {string} planId - The ID of the instant ticket plan
 * @param {string} basis - The allocation basis ('sales' or 'volume')
 */
export async function calculateAllocation(planId, basis = "sales") {
  // 1. Fetch the Plan with its scenarios, games, and marketing items
  const plan = await prisma.instantTicketPlan.findUnique({
    where: { id: planId },
    include: {
      jurisdiction: { select: { name: true, abbreviation: true } },
      scenarios: {
        orderBy: { sortOrder: "asc" },
        include: {
          games: {
            orderBy: [{ denomination: "asc" }, { sortOrder: "asc" }],
            include: {
              vendor: { select: { id: true, name: true } },
              features: { select: { featureName: true } },
            },
          },
          marketingItems: {
            orderBy: { sortOrder: "asc" },
            include: { vendor: { select: { id: true, name: true } } },
          },
        },
      },
    },
  });

  if (!plan) {
    throw new Error("Plan not found");
  }

  const scenario = plan.scenarios[0];
  const games = scenario?.games || [];
  const marketingItems = scenario?.marketingItems || [];

  const sellThrough = parseFloat(plan.sellThroughPct) / 100.0;
  const retailerCommPct = parseFloat(plan.retailerCommPct) / 100.0;

  // 2. Fetch all vendor pricing to compute printing costs
  const vendorPricing = await prisma.instantTicketVendorPricing.findMany({});

  // 3. Compute instant ticket totals (Projected Sales, units, etc.)
  let totalInstantSales = 0;
  let totalInstantUnits = 0;
  let totalInstantPrizeExpense = 0;
  let totalInstantRetailerComm = 0;
  let totalInstantPrintingCost = 0;

  const enrichedGames = games.map((game) => {
    const units = Number(game.units);
    const denom = parseFloat(game.denomination);
    const payout = parseFloat(game.payoutPercent) / 100.0;

    const grossSales = units * denom * sellThrough;
    const prizeExpense = grossSales * payout;
    const retailerComm = grossSales * retailerCommPct;

    // Printing cost
    let printingCost = 0;
    const size = game.ticketSize || "4x4";
    const pricing = vendorPricing.find(
      (p) => p.vendorId === game.vendorId && p.ticketSize === size
    );
    if (pricing) {
      const baseCost = parseFloat(pricing.baseCost);
      if (pricing.costModel === "percent_of_sales") {
        printingCost = (units * denom) * (baseCost / 100.0);
      } else {
        printingCost = (units / 1000) * baseCost;
      }
    } else {
      printingCost = (units / 1000) * 22.00;
    }

    totalInstantSales += grossSales;
    totalInstantUnits += units;
    totalInstantPrizeExpense += prizeExpense;
    totalInstantRetailerComm += retailerComm;
    totalInstantPrintingCost += printingCost;

    return {
      ...game,
      units: units.toString(), // Keep as string for client serialization
      grossSales,
      prizeExpense,
      retailerCommission: retailerComm,
      printingCost,
    };
  });

  // 4. Fetch Draw Game Scenario projections for the same FY
  const drawScenario = await prisma.drawGameScenario.findFirst({
    where: { jurisdictionId: plan.jurisdictionId, fiscalYear: plan.fiscalYear },
    include: { games: true },
  });

  let totalDrawSales = 0;
  if (drawScenario) {
    totalDrawSales = drawScenario.games.reduce(
      (s, g) => s + parseFloat(g.projectedSales),
      0
    );
  }

  const totalLotterySales = totalInstantSales + totalDrawSales;

  // 5. Query active central operational contracts
  const activeContracts = await prisma.contract.findMany({
    where: {
      status: "active",
      type: { in: ["specialty", "media_buying", "lead_agency"] },
    },
    include: {
      lineItems: true,
    },
  });

  // Calculate annual overhead for each contract
  let totalCentralOverhead = 0;
  const enrichedContracts = activeContracts.map((c) => {
    let annualCost = 0;
    if (c.startDate && c.endDate) {
      const start = new Date(c.startDate);
      const end = new Date(c.endDate);
      const durationMs = end.getTime() - start.getTime();
      const durationYears = Math.max(0.1, durationMs / (365.25 * 24 * 60 * 60 * 1000));
      annualCost = parseFloat(c.totalValue || 0) / durationYears;
    } else if (c.lineItems?.length > 0) {
      annualCost = c.lineItems.reduce((s, li) => s + parseFloat(li.budgetAmount || 0), 0);
    } else {
      annualCost = parseFloat(c.totalValue || c.budgetCap || 0);
    }

    totalCentralOverhead += annualCost;

    return {
      id: c.id,
      title: c.title,
      type: c.type,
      annualCost,
    };
  });

  // Calculate proportional allocation share for Instant tickets
  const instantShareFraction = totalLotterySales > 0 ? (totalInstantSales / totalLotterySales) : 0;
  const instantTicketShareOfCentralOverhead = totalCentralOverhead * instantShareFraction;

  // Allocate overhead share to individual games
  const finalGames = enrichedGames.map((game) => {
    let allocatedOverhead = 0;
    if (basis === "sales") {
      const salesFraction = totalInstantSales > 0 ? (game.grossSales / totalInstantSales) : 0;
      allocatedOverhead = instantTicketShareOfCentralOverhead * salesFraction;
    } else {
      // Volume basis
      const unitsFraction = totalInstantUnits > 0 ? (Number(game.units) / totalInstantUnits) : 0;
      allocatedOverhead = instantTicketShareOfCentralOverhead * unitsFraction;
    }

    const fullyLoadedCost = game.prizeExpense + game.retailerCommission + game.printingCost + allocatedOverhead;
    const fullyLoadedProfit = game.grossSales - fullyLoadedCost;
    const fullyLoadedMargin = game.grossSales > 0 ? (fullyLoadedProfit / game.grossSales) * 100 : 0;

    return {
      ...game,
      allocatedOverhead,
      fullyLoadedCost,
      fullyLoadedProfit,
      fullyLoadedMargin,
    };
  });

  // Enrich contracts with the share allocated to instant tickets
  const finalContracts = enrichedContracts.map((c) => {
    const allocatedToInstant = c.annualCost * instantShareFraction;
    return {
      ...c,
      allocatedToInstant,
    };
  });

  const totalMarketingCost = marketingItems.reduce((s, m) => s + parseFloat(m.cost), 0);

  return {
    plan,
    games: finalGames,
    contracts: finalContracts,
    summary: {
      basis,
      totalInstantSales,
      totalInstantUnits,
      totalInstantPrizeExpense,
      totalInstantRetailerComm,
      totalInstantPrintingCost,
      totalDrawSales,
      totalLotterySales,
      totalCentralOverhead,
      instantShareFraction,
      instantTicketShareOfCentralOverhead,
      totalMarketingCost,
    },
  };
}
