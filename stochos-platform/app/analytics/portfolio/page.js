export const dynamic = 'force-dynamic';

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppShell from "../../components/AppShell";
import ShinyEmbed from "../../components/ShinyEmbed";

export const metadata = {
  title: "Portfolio Mix | Stochos Platform",
};

export default async function PortfolioPage() {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <AppShell>
      <div className="page-header" style={{ borderBottom: "none", paddingBottom: "16px" }}>
        <div className="flex items-center justify-between">
          <div>
            <h2>Portfolio Mix</h2>
            <p>Product lifecycle, category summaries, and game-level penetration mix</p>
          </div>
        </div>
      </div>
      <div style={{ flex: 1, padding: "0 24px 24px 24px", display: "flex", flexDirection: "column" }}>
        <ShinyEmbed tabName="product_mix" title="Portfolio Mix" />
      </div>
    </AppShell>
  );
}
