"use client";

import dynamicImport from "next/dynamic";

const TerritoriesClient = dynamicImport(() => import("./TerritoriesClient"), {
  ssr: false,
  loading: () => (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "600px", color: "var(--text-muted)" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: "32px", height: "32px", border: "2px solid var(--border)", borderTopColor: "var(--primary)", borderRadius: "50%", margin: "0 auto 16px auto", animation: "spin 1s linear infinite" }}></div>
        Initializing Territory Manager...
      </div>
    </div>
  )
});

export default function TerritoriesWrapper({ retailers, routes, users, auditLogs, currentUser }) {
  return (
    <TerritoriesClient 
      retailers={retailers} 
      routes={routes} 
      users={users} 
      auditLogs={auditLogs} 
      currentUser={currentUser} 
    />
  );
}
