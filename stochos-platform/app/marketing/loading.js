'use client';

import AppShell from "../components/AppShell";
import Skeleton from "../components/Skeleton";

export default function Loading() {
  return (
    <AppShell>
      <div className="page-header">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <div>
            <Skeleton width="180px" height="28px" style={{ marginBottom: "6px" }} />
            <Skeleton width="340px" height="14px" />
          </div>
          <Skeleton width="140px" height="38px" />
        </div>
      </div>
      <div className="page-body" style={{ display: "flex", flexDirection: "column", gap: 24 }}>
        {/* KPI Cards skeleton */}
        <div className="kpi-grid">
          {[1, 2, 3].map((i) => (
            <div className="kpi-card" style={{ padding: "20px" }} key={i}>
              <Skeleton width="55%" height="12px" style={{ marginBottom: "12px" }} />
              <Skeleton width="75%" height="28px" />
            </div>
          ))}
        </div>

        {/* Table skeleton */}
        <div className="card">
          <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <Skeleton width="160px" height="16px" />
            <Skeleton width="120px" height="28px" />
          </div>
          <div className="card-body" style={{ padding: "20px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Header row */}
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border)", paddingBottom: "12px" }}>
                <Skeleton width="25%" height="14px" />
                <Skeleton width="18%" height="14px" />
                <Skeleton width="12%" height="14px" />
                <Skeleton width="12%" height="14px" />
                <Skeleton width="15%" height="14px" />
                <Skeleton width="10%" height="14px" />
              </div>
              {/* Data rows */}
              {[1, 2, 3, 4].map((row) => (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }} key={row}>
                  <Skeleton width="25%" height="16px" />
                  <Skeleton width="18%" height="16px" />
                  <Skeleton width="12%" height="16px" />
                  <Skeleton width="12%" height="16px" />
                  <Skeleton width="15%" height="16px" />
                  <Skeleton width="10%" height="16px" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
