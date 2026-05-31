export const dynamic = 'force-dynamic';

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppShell from "../components/AppShell";
import SpatialOpsClient from "./SpatialOpsClient";

export const metadata = {
  title: "Spatial Operations, Logistics & Risk (SOLR) | Stochos Platform",
};

export default async function SpatialOpsPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const ewsUrl = process.env.SHINY_EWS_URL || "http://100.94.253.6:3838/ews";

  return (
    <AppShell>
      <div className="page-header" style={{ borderBottom: "none", paddingBottom: "16px" }}>
        <div className="flex items-center justify-between">
          <div>
            <h2>Spatial Operations, Logistics & Risk (SOLR)</h2>
            <p>Real-time weather/earthquake monitoring, retailer risk assessments, and logistical planning</p>
          </div>
        </div>
      </div>
      <div style={{ flex: 1, padding: "0 24px 24px 24px", display: "flex", flexDirection: "column" }}>
        <SpatialOpsClient baseUrl={ewsUrl} />
      </div>
    </AppShell>
  );
}
