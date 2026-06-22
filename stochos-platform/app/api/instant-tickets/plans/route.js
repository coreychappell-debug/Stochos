import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/instant-tickets/plans — list all plans
export async function GET() {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const plans = await prisma.instantTicketPlan.findMany({
    include: {
      jurisdiction: { select: { name: true, abbreviation: true } },
      scenarios: {
        select: {
          id: true,
          name: true,
          _count: { select: { games: true, marketingItems: true } },
        },
        orderBy: { sortOrder: "asc" },
      },
    },
    orderBy: { updatedAt: "desc" },
  });

  // Aggregate game counts and total units per plan
  const enriched = await Promise.all(
    plans.map(async (plan) => {
      const scenarioIds = plan.scenarios.map((s) => s.id);
      const gameAgg = await prisma.instantTicketGame.aggregate({
        where: { scenarioId: { in: scenarioIds } },
        _count: true,
        _sum: { units: true },
      });
      return {
        ...plan,
        totalSalesTarget: plan.totalSalesTarget.toString(),
        _gameCount: gameAgg._count,
        _totalUnits: gameAgg._sum.units?.toString() || "0",
      };
    })
  );

  return NextResponse.json(enriched);
}

// POST /api/instant-tickets/plans — create a new plan
export async function POST(request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { jurisdictionId, name, fiscalYear, totalSalesTarget, retailerCommPct, adminExpensePct, sellThroughPct } = body;

  if (!jurisdictionId || !name || !fiscalYear) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const plan = await prisma.instantTicketPlan.create({
    data: {
      jurisdictionId,
      name,
      fiscalYear: parseInt(fiscalYear),
      totalSalesTarget: parseFloat(totalSalesTarget) || 0,
      retailerCommPct: parseFloat(retailerCommPct) || 5.0,
      adminExpensePct: parseFloat(adminExpensePct) || 0.0,
      sellThroughPct: parseFloat(sellThroughPct) || 98.0,
      status: "draft",
      scenarios: {
        create: {
          name: "Base Plan",
          sortOrder: 0,
          denominations: [
            { price: 1, mixPercent: 10, isActive: true },
            { price: 2, mixPercent: 15, isActive: true },
            { price: 3, mixPercent: 10, isActive: true },
            { price: 5, mixPercent: 25, isActive: true },
            { price: 10, mixPercent: 20, isActive: true },
            { price: 20, mixPercent: 15, isActive: true },
            { price: 25, mixPercent: 0, isActive: false },
            { price: 30, mixPercent: 5, isActive: true },
            { price: 50, mixPercent: 0, isActive: false },
          ],
        },
      },
    },
    include: { scenarios: true },
  });

  // Carryover games lookup and cloning
  try {
    const prevPlan = await prisma.instantTicketPlan.findFirst({
      where: {
        jurisdictionId,
        fiscalYear: parseInt(fiscalYear) - 1,
      },
      include: {
        scenarios: {
          orderBy: { sortOrder: "asc" },
          take: 1,
          include: {
            games: true,
          },
        },
      },
    });

    if (prevPlan && prevPlan.scenarios.length > 0) {
      const prevGames = prevPlan.scenarios[0].games;
      const carryoverGamesToCreate = [];
      const boundaryYear = parseInt(fiscalYear) - 1;
      const boundaryDate = new Date(`${boundaryYear}-07-01T00:00:00.000Z`);

      for (const g of prevGames) {
        if (!g.launchDate) continue;

        const status = (g.deliveryStatus || "").toLowerCase();
        if (status === "cancelled" || status === "ended" || status === "closed") continue;

        let closeDate = g.closeDate;
        if (!closeDate) {
          const d = new Date(g.launchDate);
          d.setUTCMonth(d.getUTCMonth() + 3);
          closeDate = d;
        } else {
          closeDate = new Date(closeDate);
        }

        if (closeDate >= boundaryDate) {
          carryoverGamesToCreate.push({
            scenarioId: plan.scenarios[0].id,
            vendorId: g.vendorId,
            productId: g.productId,
            gameNumber: g.gameNumber,
            name: g.name,
            denomination: g.denomination,
            ticketSize: g.ticketSize,
            units: g.units,
            payoutPercent: g.payoutPercent,
            topPrize: g.topPrize,
            launchDate: g.launchDate,
            closeDate: g.closeDate,
            endDate: g.endDate,
            poNumber: g.poNumber,
            poDate: g.poDate,
            receiptDate: g.receiptDate,
            deliveryStatus: g.deliveryStatus,
            sortOrder: g.sortOrder,
            isReorder: g.isReorder,
            licensedBrandId: g.licensedBrandId,
            budgetStatus: "already_booked",
            gamingSystemPercent: g.gamingSystemPercent,
            retailerBonusPercent: g.retailerBonusPercent,
            fixedOperatingCost: g.fixedOperatingCost,
            retailerCashingPercent: g.retailerCashingPercent,
            cashablePrizePercent: g.cashablePrizePercent,
            jackpotBonusPercent: g.jackpotBonusPercent,
            jackpotEligiblePercent: g.jackpotEligiblePercent,
            jackpotBonusCap: g.jackpotBonusCap,
            projectedReturnRate: g.projectedReturnRate,
            licenseExpirationDate: g.licenseExpirationDate,
            productFamily: g.productFamily,
            imageUrl: g.imageUrl,
          });
        }
      }

      if (carryoverGamesToCreate.length > 0) {
        await prisma.instantTicketGame.createMany({
          data: carryoverGamesToCreate,
        });
      }
    }
  } catch (err) {
    console.error("Failed to copy carryover games:", err);
  }

  return NextResponse.json(plan, { status: 201 });
}
