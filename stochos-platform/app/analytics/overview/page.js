export const dynamic = 'force-dynamic';

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppShell from "../../components/AppShell";
import OverviewClient from "./OverviewClient";
import { prisma } from "@/lib/db";

export const metadata = {
  title: "Executive Overview | New York State Lottery",
};

export default async function OverviewPage() {
  const session = await auth();
  if (!session) redirect("/login");

  // Fetch the pre-computed executive overview marts
  const [daily, mix, alerts] = await Promise.all([
    prisma.martExecOverviewDaily.findMany({
      orderBy: {
        date: "asc",
      },
    }),
    prisma.martExecMixSummary.findMany({
      orderBy: {
        productGroup: "asc",
      },
    }),
    prisma.martExecAlert.findMany({
      orderBy: {
        alertDate: "desc",
      },
    }),
  ]);

  return (
    <AppShell>
      <div className="page-header" style={{ borderBottom: "none", paddingBottom: "16px" }}>
        <div className="flex items-center justify-between">
          <div>
            <h2>Executive Overview</h2>
            <p>High-level strategic KPIs, revenue trends, and economic waterfalls</p>
          </div>
        </div>
      </div>
      <div style={{ flex: 1, padding: "0 24px 24px 24px", display: "flex", flexDirection: "column" }}>
        <OverviewClient
          initialDaily={JSON.parse(JSON.stringify(daily))}
          initialMix={JSON.parse(JSON.stringify(mix))}
          initialAlerts={JSON.parse(JSON.stringify(alerts))}
        />
      </div>
    </AppShell>
  );
}
