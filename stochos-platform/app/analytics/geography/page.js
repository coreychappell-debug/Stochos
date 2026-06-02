export const dynamic = 'force-dynamic';

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppShell from "../../components/AppShell";
import ShinyEmbed from "../../components/ShinyEmbed";

export const metadata = {
  title: "Geography & Network | Stochos Platform",
};

export default async function GeographyPage() {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <AppShell>
      <div className="page-header" style={{ borderBottom: "none", paddingBottom: "16px" }}>
        <div className="flex items-center justify-between">
          <div>
            <h2>Geography & Network</h2>
            <p>County socio-demographic indicators, leaderboards, and market distributions</p>
          </div>
        </div>
      </div>
      <div style={{ flex: 1, padding: "0 24px 24px 24px", display: "flex", flexDirection: "column" }}>
        <ShinyEmbed tabName="geo_network" title="Geography & Network" />
      </div>
    </AppShell>
  );
}
