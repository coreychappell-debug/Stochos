import { auth } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

// GET /api/instant-tickets/plans/[id] — load a full plan with all nested data
export async function GET(request, { params }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const plan = await prisma.instantTicketPlan.findUnique({
    where: { id },
    include: {
      jurisdiction: { select: { name: true, abbreviation: true } },
      scenarios: {
        orderBy: { sortOrder: "asc" },
        include: {
          games: {
            orderBy: { sortOrder: "asc" },
            include: {
              vendor: { select: { id: true, name: true, type: true } },
              features: { select: { featureName: true } },
            },
          },
          marketingItems: {
            orderBy: { sortOrder: "asc" },
            include: {
              vendor: { select: { id: true, name: true } },
            },
          },
        },
      },
    },
  });

  if (!plan) return NextResponse.json({ error: "Plan not found" }, { status: 404 });

  // Also load vendor pricing for all printer vendors
  const vendorPricing = await prisma.instantTicketVendorPricing.findMany({
    include: { vendor: { select: { id: true, name: true } } },
    orderBy: [{ vendorId: "asc" }, { ticketSize: "asc" }],
  });

  // Serialize BigInt values
  const serialized = JSON.parse(
    JSON.stringify(plan, (key, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );

  const serializedPricing = JSON.parse(
    JSON.stringify(vendorPricing, (key, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );

  return NextResponse.json({ plan: serialized, vendorPricing: serializedPricing });
}

// PUT /api/instant-tickets/plans/[id] — save full plan data (metadata, scenarios, games, marketing, pricing)
export async function PUT(request, { params }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const body = await request.json();

  try {
    const currentPlan = await prisma.instantTicketPlan.findUnique({
      where: { id },
      select: { updatedAt: true }
    });

    if (!currentPlan) {
      return NextResponse.json({ error: "Plan not found" }, { status: 404 });
    }

    if (body.updatedAt && new Date(body.updatedAt).getTime() !== new Date(currentPlan.updatedAt).getTime()) {
      return NextResponse.json({
        error: "Conflict",
        details: "This plan has been modified by another user. Please reload the page to see their changes."
      }, { status: 409 });
    }

    const updatedPlan = await prisma.$transaction(async (tx) => {
      // 1. Update main plan metadata
      const planUpdateData = {
        name: body.name,
        fiscalYear: body.fiscalYear ? parseInt(body.fiscalYear) : undefined,
        totalSalesTarget: body.totalSalesTarget !== undefined ? parseFloat(body.totalSalesTarget) : undefined,
        retailerCommPct: body.retailerCommPct !== undefined ? parseFloat(body.retailerCommPct) : undefined,
        adminExpensePct: body.adminExpensePct !== undefined ? parseFloat(body.adminExpensePct) : undefined,
        sellThroughPct: body.sellThroughPct !== undefined ? parseFloat(body.sellThroughPct) : undefined,
        status: body.status,
        notes: body.notes,
      };

      // Clean undefined keys
      Object.keys(planUpdateData).forEach(
        (key) => planUpdateData[key] === undefined && delete planUpdateData[key]
      );

      const savedPlan = await tx.instantTicketPlan.update({
        where: { id },
        data: planUpdateData,
      });

      // Load all printer vendors in jurisdiction to map frontend IDs ('sg', 'pb', 'igt') to DB UUIDs
      const vendors = await tx.vendor.findMany({
        where: { type: 'printer', jurisdictionId: savedPlan.jurisdictionId }
      });
      const vendorIdMap = {};
      for (const v of vendors) {
        if (v.name.toLowerCase().includes('scientific')) vendorIdMap.sg = v.id;
        else if (v.name.toLowerCase().includes('pollard')) vendorIdMap.pb = v.id;
        else if (v.name.toLowerCase().includes('igt') || v.name.toLowerCase().includes('game tech') || v.name.toLowerCase().includes('brightstar')) vendorIdMap.igt = v.id;
      }

      // 2. Save nested scenarios, games, and marketing items if provided
      if (body.scenarios && Array.isArray(body.scenarios)) {
        for (const sc of body.scenarios) {
          let scenarioRecord = await tx.instantTicketScenario.findFirst({
            where: { planId: id, name: sc.name }
          });

          if (!scenarioRecord) {
            scenarioRecord = await tx.instantTicketScenario.create({
              data: {
                planId: id,
                name: sc.name,
                denominations: sc.denominations || []
              }
            });
          } else {
            scenarioRecord = await tx.instantTicketScenario.update({
              where: { id: scenarioRecord.id },
              data: {
                denominations: sc.denominations || []
              }
            });
          }

          const scenarioId = scenarioRecord.id;

          // Delete existing games and marketing items to replace them
          await tx.instantTicketGame.deleteMany({ where: { scenarioId } });
          await tx.instantTicketMarketingItem.deleteMany({ where: { scenarioId } });

          // Re-insert games
          if (sc.games && Array.isArray(sc.games)) {
            let sortOrder = 0;
            for (const g of sc.games) {
              let productRecord = null;
              if (g.name) {
                productRecord = await tx.product.findFirst({
                  where: { jurisdictionId: savedPlan.jurisdictionId, name: g.name, category: 'instant' }
                });
                if (!productRecord) {
                  productRecord = await tx.product.create({
                    data: {
                      jurisdictionId: savedPlan.jurisdictionId,
                      name: g.name,
                      category: 'instant',
                      type: 'scratch_off',
                      price: parseFloat(g.denominationPrice || g.denomination || 0),
                      status: 'active',
                      externalCode: g.gameNumber || null,
                      externalSource: 'instant_ticket_planner'
                    }
                  });
                }
              }

              const createdGame = await tx.instantTicketGame.create({
                data: {
                  scenarioId,
                  vendorId: vendorIdMap[g.vendorId] || g.vendorId || null,
                  productId: productRecord ? productRecord.id : null,
                  gameNumber: g.gameNumber || '',
                  name: g.name || 'New Game',
                  denomination: parseInt(g.denominationPrice || g.denomination || 1),
                  ticketSize: g.ticketSize || '4x4',
                  units: BigInt(g.units || 0),
                  payoutPercent: parseFloat(g.payoutPercent || 0),
                  topPrize: g.topPrize !== undefined && g.topPrize !== null ? parseFloat(g.topPrize) : null,
                  launchDate: g.launchDate ? new Date(g.launchDate) : null,
                  closeDate: g.closeDate ? new Date(g.closeDate) : null,
                  endDate: g.endDate ? new Date(g.endDate) : null,
                  poNumber: g.poNumber || null,
                  poDate: g.poDate ? new Date(g.poDate) : null,
                  receiptDate: g.receiptDate ? new Date(g.receiptDate) : null,
                  deliveryStatus: g.deliveryStatus ? g.deliveryStatus.toLowerCase() : 'planned',
                  isReorder: g.isReorder === true || g.isReorder === 'true',
                  licensedBrandId: g.licensedBrandId || null,
                  budgetStatus: g.budgetStatus || 'new_request',
                  gamingSystemPercent: g.gamingSystemPercent !== undefined && g.gamingSystemPercent !== null ? parseFloat(g.gamingSystemPercent) : null,
                  retailerBonusPercent: g.retailerBonusPercent !== undefined && g.retailerBonusPercent !== null ? parseFloat(g.retailerBonusPercent) : null,
                  fixedOperatingCost: g.fixedOperatingCost !== undefined && g.fixedOperatingCost !== null ? parseFloat(g.fixedOperatingCost) : null,
                  retailerCashingPercent: g.retailerCashingPercent !== undefined && g.retailerCashingPercent !== null ? parseFloat(g.retailerCashingPercent) : null,
                  cashablePrizePercent: g.cashablePrizePercent !== undefined && g.cashablePrizePercent !== null ? parseFloat(g.cashablePrizePercent) : null,
                  jackpotBonusPercent: g.jackpotBonusPercent !== undefined && g.jackpotBonusPercent !== null ? parseFloat(g.jackpotBonusPercent) : null,
                  jackpotEligiblePercent: g.jackpotEligiblePercent !== undefined && g.jackpotEligiblePercent !== null ? parseFloat(g.jackpotEligiblePercent) : null,
                  jackpotBonusCap: g.jackpotBonusCap !== undefined && g.jackpotBonusCap !== null ? parseFloat(g.jackpotBonusCap) : null,
                  projectedReturnRate: g.projectedReturnRate !== undefined && g.projectedReturnRate !== null ? parseFloat(g.projectedReturnRate) : 0,
                  licenseExpirationDate: g.licenseExpirationDate ? new Date(g.licenseExpirationDate) : null,
                  productFamily: g.productFamily || null,
                  imageUrl: g.imageUrl || null,
                  sortOrder: sortOrder++
                }
              });

              if (g.featureIds && Array.isArray(g.featureIds)) {
                for (const fName of g.featureIds) {
                  await tx.instantTicketGameFeature.create({
                    data: {
                      gameId: createdGame.id,
                      featureName: fName
                    }
                  });
                }
              }
            }
          }

          // Re-insert marketing items
          if (sc.marketingItems && Array.isArray(sc.marketingItems)) {
            let sortOrder = 0;
            for (const m of sc.marketingItems) {
              await tx.instantTicketMarketingItem.create({
                data: {
                  scenarioId,
                  vendorId: vendorIdMap[m.vendorId] || m.vendorId || null,
                  name: m.name || 'New Item',
                  description: m.description || null,
                  cost: parseFloat(m.cost || 0),
                  category: m.category || null,
                  budgetStatus: m.budgetStatus || 'new_request',
                  sortOrder: sortOrder++
                }
              });
            }
          }
        }
      }
      // 3. Update global vendor pricing if provided
      if (body.vendorPricing && typeof body.vendorPricing === 'object') {
        for (const [vKey, vp] of Object.entries(body.vendorPricing)) {
          const vId = vendorIdMap[vKey] || vKey;
          if (vp.baseCosts && typeof vp.baseCosts === 'object') {
            for (const [size, tiers] of Object.entries(vp.baseCosts)) {
              if (Array.isArray(tiers)) {
                await tx.instantTicketVendorPricing.deleteMany({
                  where: { vendorId: vId, ticketSize: size }
                });
                for (const t of tiers) {
                  await tx.instantTicketVendorPricing.create({
                    data: {
                      vendorId: vId,
                      costModel: vp.costModel || 'per_thousand',
                      ticketSize: size,
                      baseCost: parseFloat(t.cost || 0),
                      minQuantity: BigInt(t.quantity || 0),
                      reorderModel: vp.reorderModel || 'none',
                      reorderValue: parseFloat(vp.reorderValue || 0),
                      gamingSystemPercent: vp.gamingSystemPercent !== undefined ? parseFloat(vp.gamingSystemPercent) : 2.50,
                      retailerBonusPercent: vp.retailerBonusPercent !== undefined ? parseFloat(vp.retailerBonusPercent) : 0.50,
                      fixedOperatingCost: vp.fixedOperatingCost !== undefined ? parseFloat(vp.fixedOperatingCost) : 0.00,
                      retailerCashingPercent: vp.retailerCashingPercent !== undefined ? parseFloat(vp.retailerCashingPercent) : 1.00,
                      cashablePrizePercent: vp.cashablePrizePercent !== undefined ? parseFloat(vp.cashablePrizePercent) : 70.00,
                      jackpotBonusPercent: vp.jackpotBonusPercent !== undefined ? parseFloat(vp.jackpotBonusPercent) : 0.50,
                      jackpotEligiblePercent: vp.jackpotEligiblePercent !== undefined ? parseFloat(vp.jackpotEligiblePercent) : 10.00,
                      jackpotBonusCap: vp.jackpotBonusCap !== undefined ? parseFloat(vp.jackpotBonusCap) : 1000000.00
                    }
                  });
                }
              }
            }
          }
        }
      }
      return savedPlan;
    });

    // Load full updated plan to return
    const finalPlan = await prisma.instantTicketPlan.findUnique({
      where: { id: updatedPlan.id },
      include: {
        jurisdiction: { select: { name: true, abbreviation: true } },
        scenarios: {
          orderBy: { sortOrder: "asc" },
          include: {
            games: {
              orderBy: { sortOrder: "asc" },
              include: {
                vendor: { select: { id: true, name: true, type: true } },
                features: { select: { featureName: true } },
              },
            },
            marketingItems: {
              orderBy: { sortOrder: "asc" },
              include: {
                vendor: { select: { id: true, name: true } },
              },
            },
          },
        },
      },
    });

    // Serialize BigInts safely
    const serialized = JSON.parse(
      JSON.stringify(finalPlan, (key, value) =>
        typeof value === "bigint" ? value.toString() : value
      )
    );

    return NextResponse.json(serialized);
  } catch (error) {
    console.error("Failed to save instant ticket plan:", error);
    return NextResponse.json({ error: error.message || "Failed to save plan" }, { status: 500 });
  }
}

// DELETE /api/instant-tickets/plans/[id] — archive a plan
export async function DELETE(request, { params }) {
  const session = await auth();
  if (!session) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  await prisma.instantTicketPlan.update({
    where: { id },
    data: { status: "archived" },
  });

  return NextResponse.json({ success: true });
}
