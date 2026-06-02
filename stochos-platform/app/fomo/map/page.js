"use client";
import AppShell from "../../components/AppShell";
import dynamicImport from "next/dynamic";
import { useEffect } from "react";

// Dynamically import the map client to avoid SSR issues
const VcrmMapClient = dynamicImport(() => import("./VcrmMapClient"), {
  ssr: false,
  loading: () => (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "600px", color: "var(--text-muted)" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: "32px", height: "32px", border: "2px solid var(--border)", borderTopColor: "var(--primary)", borderRadius: "50%", margin: "0 auto 16px auto", animation: "spin 1s linear infinite" }}></div>
        Initializing VCRM Map...
      </div>
    </div>
  )
});

export default function VcrmMapPage() {
  useEffect(() => {
    document.title = "VCRM Partner Map | Stochos Platform";
  }, []);

  return (
    <AppShell>
      <div className="page-header" style={{ borderBottom: "none", paddingBottom: "16px" }}>
        <h2>VCRM Route & Merchandising Map</h2>
        <p>Visitations, Coaching, Freshness Indices, and Support Opportunities</p>
      </div>
      <div style={{ flex: 1, padding: "0 24px 24px 24px", display: "flex", flexDirection: "column" }}>
        <VcrmMapClient />
      </div>
    </AppShell>
  );
}
