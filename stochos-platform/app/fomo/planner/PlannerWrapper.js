"use client";

import dynamicImport from "next/dynamic";

const PlannerClient = dynamicImport(() => import("./PlannerClient"), {
  ssr: false,
  loading: () => (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center", minHeight: "600px", color: "var(--text-muted)" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: "32px", height: "32px", border: "2px solid var(--border)", borderTopColor: "var(--primary)", borderRadius: "50%", margin: "0 auto 16px auto", animation: "spin 1s linear infinite" }}></div>
        Initializing Trip Planner...
      </div>
    </div>
  )
});

export default function PlannerWrapper({ retailers, routes, chains, users, currentUser }) {
  return <PlannerClient retailers={retailers} routes={routes} chains={chains} users={users} currentUser={currentUser} />;
}
