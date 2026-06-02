export const dynamic = 'force-dynamic';

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppShell from "../../components/AppShell";
import ShinyEmbed from "../../components/ShinyEmbed";

export const metadata = {
  title: "Forecast & Outlook | Stochos Platform",
};

export default async function ForecastPage() {
  const session = await auth();
  if (!session) redirect("/login");

  return (
    <AppShell>
      <div className="page-header" style={{ borderBottom: "none", paddingBottom: "16px" }}>
        <div className="flex items-center justify-between">
          <div>
            <h2>Forecast & Outlook</h2>
            <p>Predictive sales analysis, seasonal projections, and model settings</p>
          </div>
        </div>
      </div>
      <div style={{ flex: 1, padding: "0 24px 24px 24px", display: "flex", flexDirection: "column" }}>
        <ShinyEmbed tabName="forecast_outlook" title="Forecast & Outlook" />
      </div>
    </AppShell>
  );
}
