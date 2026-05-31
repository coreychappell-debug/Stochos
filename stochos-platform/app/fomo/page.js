export const dynamic = "force-dynamic";

import { prisma } from "@/lib/db";
import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppShell from "../components/AppShell";
import FomoDashboardClient from "./FomoDashboardClient";

export default async function FomoDashboardPage() {
  const session = await auth();
  if (!session) redirect("/login");

  // Fetch summaries
  const [
    totalVisits,
    totalRetailers,
    trainedRetailers,
    openExceptions,
    recentVisits,
    allMerchLogs,
    routes
  ] = await Promise.all([
    prisma.crmVisit.count({ where: { status: "completed" } }).catch(() => 0),
    prisma.crmRetailer.count().catch(() => 0),
    prisma.crmRetailer.count({ where: { trainingStatus: "trained" } }).catch(() => 0),
    prisma.crmDiscrepancyException.findMany({
      where: { status: "open" },
      include: {
        retailer: { select: { name: true, city: true } }
      },
      orderBy: { createdAt: "desc" }
    }).catch(() => []),
    prisma.crmVisit.findMany({
      include: {
        retailer: { select: { name: true, city: true, externalId: true } },
        user: { select: { name: true } }
      },
      orderBy: { visitDate: "desc" },
      take: 5
    }).catch(() => []),
    prisma.crmMerchandising.findMany().catch(() => []),
    prisma.crmRoute.findMany({
      include: {
        _count: { select: { retailers: true } },
        rep: { select: { name: true } }
      }
    }).catch(() => [])
  ]);

  // Calculate Merch Score
  let merchComplianceCount = 0;
  let oosCount = 0;
  if (allMerchLogs.length > 0) {
    allMerchLogs.forEach(m => {
      if (m.dispensersCleanAndFilled && m.posSignageVisible && m.ticketInventoryAdequate) {
        merchComplianceCount++;
      }
      if (!m.ticketInventoryAdequate) {
        oosCount++;
      }
    });
  }
  const merchScore = allMerchLogs.length > 0 
    ? Math.round((merchComplianceCount / allMerchLogs.length) * 100) 
    : 100;
  const oosRate = allMerchLogs.length > 0 
    ? Math.round((oosCount / allMerchLogs.length) * 100) 
    : 0;

  const coachingCoverage = totalRetailers > 0 
    ? Math.round((trainedRetailers / totalRetailers) * 100) 
    : 0;

  const stats = {
    totalVisits,
    totalRetailers,
    coachingCoverage,
    merchScore,
    oosRate,
    openExceptionsCount: openExceptions.length
  };

  return (
    <AppShell>
      <div className="page-header">
        <h2>Field Operations, Merchandising & Oversight (FOMO)</h2>
        <p>SaaS Overlay Registry, Audits, and Field Assets Supervision</p>
      </div>
      <div className="page-body">
        <FomoDashboardClient 
          stats={stats} 
          recentVisits={JSON.parse(JSON.stringify(recentVisits))} 
          openExceptions={JSON.parse(JSON.stringify(openExceptions))}
          routes={JSON.parse(JSON.stringify(routes))}
        />
      </div>
    </AppShell>
  );
}
