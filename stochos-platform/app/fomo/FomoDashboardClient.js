"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";

export default function FomoDashboardClient({ stats, recentVisits, openExceptions, routes }) {
  const router = useRouter();

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      
      {/* Action Buttons Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/fomo/retailers" className="btn btn-secondary">
            🏪 Retailer Registry
          </Link>
          <Link href="/fomo/mismatches" className="btn btn-secondary">
            🗺️ Geodata Audit
          </Link>
          <Link href="/fomo/import" className="btn btn-secondary">
            📥 Importer Console
          </Link>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="kpi-grid">
        <div className="kpi-card kpi-blue">
          <div className="kpi-label">Completed Visits</div>
          <div className="kpi-value">{stats.totalVisits}</div>
          <div className="kpi-subtitle">Across {stats.totalRetailers} retailers</div>
        </div>
        <div className="kpi-card kpi-green">
          <div className="kpi-label">Coaching Coverage</div>
          <div className="kpi-value">{stats.coachingCoverage}%</div>
          <div className="kpi-subtitle">"Ask for the Sale" trained</div>
        </div>
        <div className="kpi-card kpi-gold">
          <div className="kpi-label">Merch Display Compliance</div>
          <div className="kpi-value">{stats.merchScore}%</div>
          <div className="kpi-subtitle">All signs & displays verified</div>
        </div>
        <div className="kpi-card kpi-red">
          <div className="kpi-label">Active Exceptions</div>
          <div className="kpi-value">{stats.openExceptionsCount}</div>
          <div className="kpi-subtitle">OOS Rate: {stats.oosRate}%</div>
        </div>
      </div>

      {/* Grid of Main Sections */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(450px, 1fr))", gap: 24 }}>
        
        {/* Open Exceptions Card */}
        <div className="card">
          <div className="card-header">
            <h3>⚠️ Active Equipment Exceptions & Discrepancies</h3>
            <span className="badge badge-rejected">{openExceptions.length} Open</span>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {openExceptions.length === 0 ? (
              <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
                No active discrepancies found. Expected matches observed state 🚀
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Store</th>
                    <th>Issue</th>
                    <th>Date</th>
                  </tr>
                </thead>
                <tbody>
                  {openExceptions.map((ex) => (
                    <tr key={ex.id}>
                      <td>
                        <Link href={`/fomo/retailers/${ex.retailerId}`} style={{ fontWeight: 600 }}>
                          {ex.retailer?.name}
                        </Link>
                        <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                          {ex.retailer?.city}
                        </div>
                      </td>
                      <td style={{ color: "var(--red)" }}>{ex.title}</td>
                      <td className="muted">{new Date(ex.createdAt).toLocaleDateString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Recent Visits Card */}
        <div className="card">
          <div className="card-header">
            <h3>📝 Recent Visit Audits</h3>
            <Link href="/fomo/retailers" style={{ fontSize: 12 }}>View Registry</Link>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {recentVisits.length === 0 ? (
              <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
                No store audits logged yet.
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Retailer</th>
                    <th>Sales Representative</th>
                    <th>Date</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {recentVisits.map((v) => (
                    <tr key={v.id}>
                      <td>
                        <Link href={`/fomo/retailers/${v.retailerId}`} style={{ fontWeight: 600 }}>
                          {v.retailer?.name}
                        </Link>
                      </td>
                      <td>{v.user?.name}</td>
                      <td>{new Date(v.visitDate).toLocaleDateString()}</td>
                      <td>
                        <Link href={`/fomo/visits/${v.id}`} className="btn btn-secondary btn-sm">
                          Details
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Routes & Territory Summary */}
      <div className="card" style={{ marginTop: 8 }}>
        <div className="card-header">
          <h3>🗺️ District Route & Coverage Index</h3>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Route Code</th>
                <th>Route Name</th>
                <th>Assigned Representative</th>
                <th>Total Stores</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {routes.map((rt) => (
                <tr key={rt.id}>
                  <td style={{ fontWeight: 600, color: "var(--blue)" }}>{rt.code}</td>
                  <td>{rt.name}</td>
                  <td>{rt.rep?.name || "Unassigned"}</td>
                  <td>{rt._count?.retailers || 0} stores</td>
                  <td>
                    <span className="badge badge-active">Active</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
