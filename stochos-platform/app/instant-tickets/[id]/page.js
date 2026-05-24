import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import Sidebar from "@/app/components/Sidebar";
import PlanDetailClient from "./PlanDetailClient";

export const dynamic = "force-dynamic";

export default async function InstantTicketPlanPage({ params }) {
  const session = await auth();
  if (!session) redirect("/login");

  const { id } = await params;

  const plan = await prisma.instantTicketPlan.findUnique({
    where: { id },
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

  if (!plan) redirect("/instant-tickets");

  // Serialize BigInt/Decimal for client component
  const serializedPlan = JSON.parse(
    JSON.stringify(plan, (key, value) =>
      typeof value === "bigint" ? value.toString() : value
    )
  );

  // Compute stats server-side, pass as plain objects
  const scenario = plan.scenarios[0];
  const games = scenario?.games || [];
  const marketingItems = scenario?.marketingItems || [];

  const totalRevenue = games.reduce((s, g) => s + Number(g.units) * g.denomination, 0);
  const totalPrizeExpense = games.reduce((s, g) => s + Number(g.units) * g.denomination * (parseFloat(g.payoutPercent) / 100), 0);
  const weightedPayout = totalRevenue > 0 ? (totalPrizeExpense / totalRevenue) * 100 : 0;
  const totalMarketingCost = marketingItems.reduce((s, m) => s + parseFloat(m.cost), 0);

  const vendorAlloc = {};
  for (const g of games) {
    const vName = g.vendor?.name || "Unassigned";
    if (!vendorAlloc[vName]) vendorAlloc[vName] = { games: 0, units: 0, revenue: 0 };
    vendorAlloc[vName].games++;
    vendorAlloc[vName].units += Number(g.units);
    vendorAlloc[vName].revenue += Number(g.units) * g.denomination;
  }

  const pipeline = { planned: 0, ordered: 0, in_production: 0, shipped: 0, received: 0 };
  for (const g of games) pipeline[g.deliveryStatus] = (pipeline[g.deliveryStatus] || 0) + 1;

  const gamesByDenom = {};
  for (const g of games) {
    if (!gamesByDenom[g.denomination]) gamesByDenom[g.denomination] = [];
    gamesByDenom[g.denomination].push(g);
  }

  // Serialize games/marketing for client
  const serializedGames = JSON.parse(JSON.stringify(games, (k, v) => typeof v === "bigint" ? v.toString() : v));
  const serializedMarketing = JSON.parse(JSON.stringify(marketingItems, (k, v) => typeof v === "bigint" ? v.toString() : v));
  const serializedGamesByDenom = JSON.parse(JSON.stringify(gamesByDenom, (k, v) => typeof v === "bigint" ? v.toString() : v));

  const stats = {
    totalRevenue, totalPrizeExpense, weightedPayout, totalMarketingCost,
    vendorAlloc, pipeline, gamesByDenom: serializedGamesByDenom,
    marketingItems: serializedMarketing, games: serializedGames,
    scenario: scenario ? { name: scenario.name } : null,
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <PlanDetailClient plan={serializedPlan} stats={stats} />
      </main>
    </div>
  );
}
