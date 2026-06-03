export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppShell from "../../components/AppShell";
import PlannerWrapper from "./PlannerWrapper";

export default async function CrmPlannerPage() {
  const session = await auth();
  if (!session) redirect("/login");

  // Fetch retailers, routes and chains to allow route-building
  const [retailers, routes, chains] = await Promise.all([
    prisma.crmRetailer.findMany({
      select: {
        id: true,
        externalId: true,
        name: true,
        address: true,
        city: true,
        zipCode: true,
        latitude: true,
        longitude: true,
        status: true,
        routeId: true,
        chainId: true,
        county: true,
        dma: true,
        serviceCenter: true,
        chain: { select: { name: true } },
        route: { select: { name: true, code: true } }
      },
      orderBy: { name: "asc" }
    }),
    prisma.crmRoute.findMany({ select: { id: true, name: true, code: true } }),
    prisma.crmChainAccount.findMany({ select: { id: true, name: true } })
  ]);

  return (
    <AppShell>
      <div className="page-header" style={{ borderBottom: "none", paddingBottom: "12px" }}>
        <h2>🚗 Operational Route Trip Planner</h2>
        <p>Build, optimize, and map turn-by-turn driving itineraries for field visits and audits.</p>
      </div>
      <div style={{ flex: 1, padding: "0 24px 24px 24px", display: "flex", flexDirection: "column" }}>
        <PlannerWrapper 
          retailers={JSON.parse(JSON.stringify(retailers))}
          routes={JSON.parse(JSON.stringify(routes))}
          chains={JSON.parse(JSON.stringify(chains))}
        />
      </div>
    </AppShell>
  );
}
