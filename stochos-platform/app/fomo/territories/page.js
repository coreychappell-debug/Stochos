export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import { Users, Home } from "lucide-react";
import Link from "next/link";
import AppShell from "../../components/AppShell";
import TerritoriesWrapper from "./TerritoriesWrapper";
import HelpTrigger from "@/app/components/HelpTrigger";
import FomoSubNav from "../FomoSubNav";

export default async function FomoTerritoriesPage() {
  const session = await auth();
  if (!session) redirect("/login");

  // Enforce access control: sales representatives should not access this management tool
  if (session.user.role === "sales_rep") {
    redirect("/unauthorized");
  }

  // Fetch all active retailers, routes, representatives, and territory audit logs
  const [retailers, routes, users, auditLogs] = await Promise.all([
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
        serviceCenter: true,
        county: true,
        dma: true,
        route: {
          select: {
            name: true,
            code: true,
            repId: true
          }
        }
      },
      orderBy: { name: "asc" }
    }),
    prisma.crmRoute.findMany({
      select: {
        id: true,
        name: true,
        code: true,
        repId: true,
        rep: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    }),
    prisma.user.findMany({
      where: {
        role: { name: "sales_rep" }
      },
      select: {
        id: true,
        name: true,
        email: true,
        division: true,
        managerId: true,
        homeAddress: true,
        homeLatitude: true,
        homeLongitude: true
      },
      orderBy: { name: "asc" }
    }),
    prisma.auditLog.findMany({
      where: {
        entityType: { in: ["crm_retailer", "crm_territory_balancing"] }
      },
      include: {
        user: { select: { name: true } }
      },
      orderBy: { createdAt: "desc" },
      take: 10
    })
  ]);

  return (
    <AppShell>
      <div className="page-header" style={{ borderBottom: "none", paddingBottom: "12px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
          <div>
            <h2 style={{ display: "flex", alignItems: "center", gap: "8px", margin: 0 }}>
              <Users size={24} /> Territory Manager & Churn Console
            </h2>
            <p style={{ margin: "4px 0 0 0" }}>Propose road-network sweeps, re-balance sales rep workloads, and assign new retailers.</p>
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
        <TerritoriesWrapper 
          retailers={JSON.parse(JSON.stringify(retailers))}
          routes={JSON.parse(JSON.stringify(routes))}
          users={JSON.parse(JSON.stringify(users))}
          auditLogs={JSON.parse(JSON.stringify(auditLogs))}
          currentUser={session.user}
        />
      </div>
    </AppShell>
  );
}
