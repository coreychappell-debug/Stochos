export const dynamic = 'force-dynamic';

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppShell from "../../components/AppShell";
import PortfolioClient from "./PortfolioClient";
import { prisma } from "@/lib/db";

export const metadata = {
  title: "Product Portfolio | New York State Lottery",
};

export default async function PortfolioPage() {
  const session = await auth();
  if (!session) redirect("/login");

  // Fetch the pre-computed product portfolio marts
  const [mix, lifecycle, timeseries] = await Promise.all([
    prisma.martExecProductMix.findMany({
      orderBy: {
        grossRevenue: "desc",
      },
    }),
    prisma.martExecProductLifecycle.findMany({
      orderBy: {
        grossRevenue: "desc",
      },
    }),
    prisma.martExecProductTimeseries.findMany({
      orderBy: {
        month: "asc",
      },
    }),
  ]);

  return (
    <AppShell>
      <div className="page-header" style={{ borderBottom: "none", paddingBottom: "16px" }}>
        <div className="flex items-center justify-between">
          <div>
            <h2>Product Portfolio Mix</h2>
            <p>Product lifecycle tracking, sub-category performance, and longitudinal game mix trends</p>
          </div>
        </div>
      </div>
      <div style={{ flex: 1, padding: "0 24px 24px 24px", display: "flex", flexDirection: "column" }}>
        <PortfolioClient
          initialMix={JSON.parse(JSON.stringify(mix))}
          initialLifecycle={JSON.parse(JSON.stringify(lifecycle))}
          initialTimeseries={JSON.parse(JSON.stringify(timeseries))}
        />
      </div>
    </AppShell>
  );
}
