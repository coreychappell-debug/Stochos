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

  if (!scenario) {
    scenario = await prisma.drawGameScenario.create({
      data: {
        jurisdictionId,
        fiscalYear: fy,
        name: `FY${fy} Draw Plan`,
        status: "draft"
      },
      include: {
        games: true
      }
    });
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
