export const dynamic = 'force-dynamic';

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppShell from "../../components/AppShell";
import ShinyEmbed from "../../components/ShinyEmbed";

export const metadata = {
  title: "Retailer Profitability | Stochos Platform",
};

export default async function RetailersPage() {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <AppShell>
      <div className="page-header" style={{ borderBottom: "none", paddingBottom: "16px" }}>
        <div className="flex items-center justify-between">
          <div>
            <h2>Retailer Profitability</h2>
            <p>Retailer contribution, quadrant performance, and spatial density overlays</p>
          </div>
        </div>
      </div>
      <div style={{ flex: 1, padding: "0 24px 24px 24px", display: "flex", flexDirection: "column" }}>
        <ShinyEmbed tabName="retailer_mix" title="Retailer Profitability" />
      </div>
    </AppShell>
  );
}
