export const dynamic = 'force-dynamic';

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppShell from "../../components/AppShell";
import RetailersClient from "./RetailersClient";
import { prisma } from "@/lib/db";

export const metadata = {
  title: "Retailer Profitability | New York State Lottery",
};

export default async function RetailersPage() {
  const session = await auth();
  if (!session) redirect("/login");

  // Fetch the pre-computed retailer profitability marts
  const [channels, retailers, quadrants] = await Promise.all([
    prisma.martExecChannelMix.findMany({
      orderBy: {
        grossRevenue: "desc",
      },
    }),
    prisma.martExecRetailerMix.findMany({
      orderBy: {
        grossRevenue: "desc",
      },
    }),
    prisma.martExecRetailerQuadrant.findMany({
      orderBy: {
        grossRevenue: "desc",
      },
    }),
  ]);

  return (
    <AppShell>
      <div className="page-header" style={{ borderBottom: "none", paddingBottom: "16px" }}>
        <div className="flex items-center justify-between">
          <div>
            <h2>Retailer Profitability</h2>
            <p>Retailer contribution, quadrant performance, and channel sales distributions</p>
          </div>
        </div>
      </div>
      <div style={{ flex: 1, padding: "0 24px 24px 24px", display: "flex", flexDirection: "column" }}>
        <RetailersClient
          initialChannels={JSON.parse(JSON.stringify(channels))}
          initialRetailers={JSON.parse(JSON.stringify(retailers))}
          initialQuadrants={JSON.parse(JSON.stringify(quadrants))}
        />
      </div>
    </AppShell>
  );
}
