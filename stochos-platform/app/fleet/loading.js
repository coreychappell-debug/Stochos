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
            <Skeleton width="480px" height="14px" />
          </div>
        </div>
      </div>
      <div className="page-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Filter bar */}
        <div style={{ display: "flex", gap: 12 }}>
          <Skeleton width="25%" height="38px" />
          <Skeleton width="15%" height="38px" />
          <Skeleton width="15%" height="38px" />
          <Skeleton width="12%" height="38px" />
        </div>

        {/* Table skeleton */}
        <div className="card">
          <div className="card-body" style={{ padding: "20px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              {/* Header row */}
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border)", paddingBottom: "12px" }}>
                <Skeleton width="12%" height="14px" />
                <Skeleton width="18%" height="14px" />
                <Skeleton width="15%" height="14px" />
                <Skeleton width="15%" height="14px" />
                <Skeleton width="12%" height="14px" />
                <Skeleton width="12%" height="14px" />
                <Skeleton width="8%" height="14px" />
              </div>
              {/* Data rows */}
              {[1, 2, 3, 4, 5].map((row) => (
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }} key={row}>
                  <Skeleton width="12%" height="16px" />
                  <Skeleton width="18%" height="16px" />
                  <Skeleton width="15%" height="16px" />
                  <Skeleton width="15%" height="16px" />
                  <Skeleton width="12%" height="16px" />
                  <Skeleton width="12%" height="16px" />
                  <Skeleton width="8%" height="16px" />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
