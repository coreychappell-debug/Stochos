export const dynamic = 'force-dynamic';

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppShell from "../components/AppShell";
import AnalyticsTabs from "./AnalyticsTabs";

export const metadata = {
  title: "Analytics Portal | Stochos Platform",
};

export default async function AnalyticsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  // In production, these should be pulled from process.env.SHINY_EXEC_URL and process.env.SHINY_EWS_URL
  // For the local dev environment, we will default to the standard Shiny Server port on the Ubuntu VM IP.
  const execUrl = process.env.SHINY_EXEC_URL || "http://100.94.253.6:3838/executive";
  const ewsUrl = process.env.SHINY_EWS_URL || "http://100.94.253.6:3838/ews";

  console.log("DEBUG SHINY PATHS:", { execUrl, ewsUrl, rawExec: process.env.SHINY_EXEC_URL });

  return (
    <AppShell>
      <div className="page-header" style={{ borderBottom: "none", paddingBottom: "16px" }}>
        <div className="flex items-center justify-between">
          <div>
            <h2>Analytics & Dashboards</h2>
            <p>Stochos Early Warning System & Geographic Analysis</p>
          </div>
        </div>
      </div>
      {/* 
        We use a borderless iframe to seamlessly embed the Shiny app via the AnalyticsTabs component.
        The wrapper has standard page-body padding removed to let the map breathe.
      */}
      <div style={{ flex: 1, padding: "0 24px 24px 24px", display: "flex", flexDirection: "column" }}>
        <AnalyticsTabs execUrl={execUrl} ewsUrl={ewsUrl} />
      </div>
    </AppShell>
  );
}
