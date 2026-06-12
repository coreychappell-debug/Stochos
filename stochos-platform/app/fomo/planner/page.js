export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Car, Home } from "lucide-react";
import Link from "next/link";
import AppShell from "../../components/AppShell";
import PlannerWrapper from "./PlannerWrapper";
import HelpTrigger from "@/app/components/HelpTrigger";
import FomoSubNav from "../FomoSubNav";

export default async function CrmPlannerPage() {
  const session = await auth();
  if (!session) redirect("/login");

  // Fetch retailers, routes, chains, and users to allow route-building and rep assignment
  const [retailers, routes, chains, users] = await Promise.all([
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
    prisma.crmRoute.findMany({ select: { id: true, name: true, code: true, repId: true } }),
    prisma.crmChainAccount.findMany({ select: { id: true, name: true } }),
    prisma.user.findMany({
      select: { 
        id: true, 
        name: true, 
        email: true, 
        division: true, 
        managerId: true, 
        bureau: true, 
        subunit: true,
        homeAddress: true,
        homeLatitude: true,
        homeLongitude: true
      },
      orderBy: { name: "asc" }
    })
  ]);

  return (
    <AppShell>
      <div className="page-header" style={{ borderBottom: "none", paddingBottom: "12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
          <div>
            <h2 style={{ display: "flex", alignItems: "center", gap: "8px", margin: 0 }}>
              <Car size={24} /> Operational Route Trip Planner
            </h2>
            <p style={{ margin: "4px 0 0 0" }}>Build, optimize, and map turn-by-turn driving itineraries for field visits and audits.</p>
          </div>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <Link 
              href="/fomo"
              style={{
                padding: "8px 16px",
                background: "var(--blue-dim)",
                border: "1px solid var(--blue)",
                borderRadius: "6px",
                color: "var(--blue)",
                cursor: "pointer",
                fontWeight: "bold",
                fontSize: "13px",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                textDecoration: "none",
                transition: "all 0.15s"
              }}
            >
              Back to VCRM Hub
            </Link>
            <Link 
              href="/"
              style={{
                padding: "8px 16px",
                background: "var(--surface-3)",
                border: "1px solid var(--border)",
                borderRadius: "6px",
                color: "var(--text)",
                cursor: "pointer",
                fontWeight: "bold",
                fontSize: "13px",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                textDecoration: "none",
                transition: "all 0.15s"
              }}
            >
              <Home size={15} /> Back to Platform Hub
            </Link>
            <HelpTrigger topicId="fomo" />
          </div>
        </div>
      </div>
      <FomoSubNav />
      <div style={{ flex: 1, padding: "0 24px 24px 24px", display: "flex", flexDirection: "column" }}>
        <PlannerWrapper 
          retailers={JSON.parse(JSON.stringify(retailers))}
          routes={JSON.parse(JSON.stringify(routes))}
          chains={JSON.parse(JSON.stringify(chains))}
          users={JSON.parse(JSON.stringify(users))}
          currentUser={session.user}
        />
      </div>
    </AppShell>
  );
}
