"use client";

import { useEffect } from "react";
import AppShell from "../../components/AppShell";
import dynamicImport from "next/dynamic";

const GeographyClient = dynamicImport(() => import("./GeographyClient"), {
  ssr: false,
  loading: () => (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "600px", color: "var(--text-muted)" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: "32px", height: "32px", border: "2px solid var(--border)", borderTopColor: "var(--primary)", borderRadius: "50%", margin: "0 auto 16px auto", animation: "spin 1s linear infinite" }}></div>
        Initializing Geography Analytics Dashboard...
      </div>
    </div>
  )
});

export default function GeographyPage() {
  useEffect(() => {
    document.title = "Geography & Network | New York State Lottery";
  }, []);

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
        <GeographyClient />
      </div>
    </AppShell>
  );
}
