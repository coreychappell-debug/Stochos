export const dynamic = 'force-dynamic';

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppShell from "../../components/AppShell";
import ShinyEmbed from "../../components/ShinyEmbed";

export const metadata = {
  title: "Executive Overview | Stochos Platform",
};

export default async function OverviewPage() {
  const session = await auth();
  if (!session) redirect("/login");

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
        <ShinyEmbed tabName="exec_overview" title="Executive Overview" />
      </div>
    </AppShell>
  );
}
