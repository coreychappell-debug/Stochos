export const dynamic = 'force-dynamic';

import { auth } from "@/lib/auth";
import { redirect } from "next/navigation";
import AppShell from "../components/AppShell";
import EwsClient from "./EwsClient";

export const metadata = {
  title: "Early Warning System (EWS) | Stochos Platform",
};

export default async function EWSPage() {
  const session = await auth();
  if (!session) redirect("/login");

  const ewsUrl = process.env.SHINY_EWS_URL || "http://100.94.253.6:3838/ews";

  return (
    <AppShell>
      <div className="page-header" style={{ borderBottom: "none", paddingBottom: "16px" }}>
        <div className="flex items-center justify-between">
          <div>
            <h2>Early Warning System (EWS)</h2>
            <p>Real-time weather and earthquake hazard monitoring for New York Lottery Retailers</p>
          </div>
        </div>
      </div>
      <div style={{ flex: 1, padding: "0 24px 24px 24px", display: "flex", flexDirection: "column" }}>
        <EwsClient baseUrl={ewsUrl} />
      </div>
    </AppShell>
  );
}
