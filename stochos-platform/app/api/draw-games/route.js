import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/draw-games — Fetch Draw Game scenario and its projected items
export async function GET(request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { searchParams } = new URL(request.url);
  const fy = parseInt(searchParams.get("fiscalYear") || "2027", 10);

  // Find the active jurisdiction of the user or fallback to the first NY jurisdiction
  let jurisdictionId = session.user?.jurisdictionId;
  if (!jurisdictionId) {
    const defaultJur = await prisma.jurisdiction.findFirst({ where: { abbreviation: "NY" } });
    jurisdictionId = defaultJur?.id;
  }

  if (!jurisdictionId) {
    return NextResponse.json({ error: "Jurisdiction not found" }, { status: 404 });
  }

  // Find or create the draw game scenario for this fiscal year
  let scenario = await prisma.drawGameScenario.findFirst({
    where: { jurisdictionId, fiscalYear: fy },
    include: {
      games: {
        orderBy: { name: "asc" }
      }
    }
  });

  if (scenario) {
    // Check if any active products are missing from the scenario
    const [products, lifecycles] = await Promise.all([
      prisma.product.findMany({
        where: { jurisdictionId, category: "draw_game", status: "active" }
      }),
      prisma.martExecProductLifecycle.findMany()
    ]);

    const existingProductIds = scenario.games.map(g => g.productId).filter(Boolean);
    const missingProducts = products.filter(p => !existingProductIds.includes(p.id));

    if (missingProducts.length > 0) {
      const mapping = {
        mega_millions: ["mega", "megaplier"],
        powerball: ["powerball", "powerplay"],
        ny_lotto: ["lotto"],
        numbers: ["numbers_eve", "numbers_day"],
        win_4: ["win4_eve", "win4_day"],
        take_5: ["t5_eve", "t5_day"],
        pick_10: ["pick10"],
        quick_draw: ["quick_draw", "qd_extra", "money_dots"],
        cash4life: ["c4l"]
      };

      const payoutMapping = {
        mega_millions: 50.0,
        powerball: 50.0,
        ny_lotto: 40.0,
        numbers: 50.0,
        win_4: 50.0,
        take_5: 50.0,
        pick_10: 50.0,
        quick_draw: 60.0,
        cash4life: 50.0
      };

      for (const p of missingProducts) {
        let baselineSales = 0;
        if (p.externalCode) {
          const codes = mapping[p.externalCode];
          if (codes) {
            const matched = lifecycles.filter(l => codes.includes(l.gameCode));
            if (matched.length > 0) {
              let totalSales = 0;
              matched.forEach(m => {
                const rev = parseFloat(m.grossRevenue || 0);
                const days = m.activeDays || 365;
                totalSales += (rev / days) * 365;
              });
              baselineSales = parseFloat(totalSales.toFixed(2));
            }
          }
        }

        const prizePayout = p.externalCode ? (payoutMapping[p.externalCode] || 50.0) : 50.0;

        await prisma.drawGameProjectedItem.create({
          data: {
            scenarioId: scenario.id,
            productId: p.id,
            name: p.name,
            projectedSales: baselineSales || 1000000.00,
            prizePayoutPercent: prizePayout,
            retailerCommPercent: 6.0
          }
        });
      }

      // Re-fetch scenario with all games
      scenario = await prisma.drawGameScenario.findFirst({
        where: { id: scenario.id },
        include: {
          games: {
            orderBy: { name: "asc" }
          }
        }
      });
    }
  }

  if (!scenario) {
    // 1. Create the new scenario
    scenario = await prisma.drawGameScenario.create({
      data: {
        jurisdictionId,
        fiscalYear: fy,
        name: `FY${fy} Draw Plan`,
        status: "draft"
      }
    });

    // 2. Fetch products and lifecycles to calculate actual baseline sales
    const [products, lifecycles] = await Promise.all([
      prisma.product.findMany({
        where: { jurisdictionId, category: "draw_game", status: "active" }
      }),
      prisma.martExecProductLifecycle.findMany()
    ]);

    const mapping = {
      mega_millions: ["mega", "megaplier"],
      powerball: ["powerball", "powerplay"],
      ny_lotto: ["lotto"],
      numbers: ["numbers_eve", "numbers_day"],
      win_4: ["win4_eve", "win4_day"],
      take_5: ["t5_eve", "t5_day"],
      pick_10: ["pick10"],
      quick_draw: ["quick_draw", "qd_extra", "money_dots"],
      cash4life: ["c4l"]
    };

    const payoutMapping = {
      mega_millions: 50.0,
      powerball: 50.0,
      ny_lotto: 40.0,
      numbers: 50.0,
      win_4: 50.0,
      take_5: 50.0,
      pick_10: 50.0,
      quick_draw: 60.0,
      cash4life: 50.0
    };

    // 3. Seed games for the new scenario
    const createdGames = [];
    for (const p of products) {
      let baselineSales = 0;
      if (p.externalCode) {
        const codes = mapping[p.externalCode];
        if (codes) {
          const matched = lifecycles.filter(l => codes.includes(l.gameCode));
          if (matched.length > 0) {
            let totalSales = 0;
            matched.forEach(m => {
              const rev = parseFloat(m.grossRevenue || 0);
              const days = m.activeDays || 365;
              totalSales += (rev / days) * 365;
            });
            baselineSales = parseFloat(totalSales.toFixed(2));
          }
        }
      }

      const prizePayout = p.externalCode ? (payoutMapping[p.externalCode] || 50.0) : 50.0;

      const gameItem = await prisma.drawGameProjectedItem.create({
        data: {
          scenarioId: scenario.id,
          productId: p.id,
          name: p.name,
          projectedSales: baselineSales || 1000000.00,
          prizePayoutPercent: prizePayout,
          retailerCommPercent: 6.0
        }
      });
      createdGames.push(gameItem);
    }

    // Sort seeded games by name to match search criteria ordering
    createdGames.sort((a, b) => a.name.localeCompare(b.name));
    scenario.games = createdGames;
  }

  // Convert Decimals to Floats/Numbers for frontend serialization
  const serializedGames = scenario.games.map(g => ({
    ...g,
    projectedSales: parseFloat(g.projectedSales),
    prizePayoutPercent: parseFloat(g.prizePayoutPercent),
    retailerCommPercent: parseFloat(g.retailerCommPercent)
  }));

  return NextResponse.json({
    ...scenario,
    games: serializedGames
  });
}

// POST /api/draw-games — Update/Save projected games for a scenario
export async function POST(request) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const { scenarioId, games } = body;

  if (!scenarioId || !Array.isArray(games)) {
    return NextResponse.json({ error: "Missing scenarioId or games array" }, { status: 400 });
  }

  // Verify scenario exists
  const scenario = await prisma.drawGameScenario.findUnique({
    where: { id: scenarioId }
  });

  if (!scenario) {
    return NextResponse.json({ error: "Scenario not found" }, { status: 404 });
  }

  try {
    // Perform updates in a transaction
    const updatedGames = await prisma.$transaction(async (tx) => {
      // 1. Delete existing items
      await tx.drawGameProjectedItem.deleteMany({
        where: { scenarioId }
      });

      // 2. Create new items
      const createdItems = [];
      for (const g of games) {
        const item = await tx.drawGameProjectedItem.create({
          data: {
            scenarioId,
            productId: g.productId || null,
            name: g.name,
            projectedSales: parseFloat(g.projectedSales || 0),
            prizePayoutPercent: parseFloat(g.prizePayoutPercent || 50),
            retailerCommPercent: parseFloat(g.retailerCommPercent || 5)
          }
        });
        createdItems.push(item);
      }
      return createdItems;
    });

    const serializedGames = updatedGames.map(g => ({
      ...g,
      projectedSales: parseFloat(g.projectedSales),
      prizePayoutPercent: parseFloat(g.prizePayoutPercent),
      retailerCommPercent: parseFloat(g.retailerCommPercent)
    }));

    return NextResponse.json({ success: true, games: serializedGames });
  } catch (err) {
    console.error("Failed to update draw projections:", err);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
