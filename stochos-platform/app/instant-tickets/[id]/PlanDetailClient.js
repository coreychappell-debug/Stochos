"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

export default function PlanDetailClient({ plan, stats }) {
  const [tab, setTab] = useState("editor");
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  const handleUpdateStatus = async (newStatus) => {
    if (!confirm(`Change plan status to ${newStatus}?`)) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/instant-tickets/plans/${plan.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      });
      if (!res.ok) throw new Error("Failed to update plan status");
      router.refresh();
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const STATUS_COLORS = {
    planned: "#6b7280", ordered: "#f59e0b", in_production: "#3b82f6",
    shipped: "#8b5cf6", received: "#10b981", on_sale: "#10b981",
    closed: "#f59e0b", ended: "#ef4444",
  };

  function fmt$(val) {
    const num = parseFloat(val);
    if (num >= 1_000_000_000) return "$" + (num / 1_000_000_000).toFixed(2) + "B";
    if (num >= 1_000_000) return "$" + (num / 1_000_000).toFixed(1) + "M";
    return "$" + num.toLocaleString("en-US", { maximumFractionDigits: 0 });
  }

  function fmtUnits(val) {
    const num = Number(val);
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + "M";
    if (num >= 1_000) return (num / 1_000).toFixed(0) + "K";
    return num.toString();
  }

  const { totalRevenue, totalPrizeExpense, weightedPayout, totalMarketingCost, vendorAlloc, pipeline, gamesByDenom, marketingItems, games, scenario } = stats;

  return (
    <>
      <div className="page-header">
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <Link href="/instant-tickets" style={{ color: "var(--text-muted)", textDecoration: "none", fontSize: "14px" }}>← Back to Plans</Link>
        </div>
        <div style={{ marginTop: "8px", display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
          <div>
            <h2>{plan.name}</h2>
            <p>
              {plan.jurisdiction.name} · FY{plan.fiscalYear} · {games.length} games · {plan.scenarios.length} scenario{plan.scenarios.length !== 1 ? "s" : ""}
              {" · "}
              <span className={`badge ${plan.status === "approved" ? "badge-active" : "badge-submitted"}`}>
                {plan.status.charAt(0).toUpperCase() + plan.status.slice(1)}
              </span>
            </p>
          </div>
          <div>
            {plan.status === "approved" ? (
              <button 
                className="btn btn-secondary" 
                onClick={() => handleUpdateStatus("draft")}
                disabled={saving}
              >
                Revoke Approval / Mark as Draft
              </button>
            ) : (
              <button 
                className="btn btn-primary" 
                onClick={() => handleUpdateStatus("approved")}
                disabled={saving}
              >
                ✓ Approve Plan
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: "0", borderBottom: "2px solid var(--border)", marginBottom: "16px" }}>
        {[
          { key: "editor", label: "📝 Edit Plan" },
          { key: "summary", label: "📊 Summary" },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: "10px 24px",
              background: tab === t.key ? "var(--bg-card)" : "transparent",
              color: tab === t.key ? "var(--primary)" : "var(--text-muted)",
              border: "none",
              borderBottom: tab === t.key ? "2px solid var(--primary)" : "2px solid transparent",
              marginBottom: "-2px",
              cursor: "pointer",
              fontWeight: tab === t.key ? 600 : 400,
              fontSize: "14px",
              transition: "all 0.2s ease",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Editor Tab — Embedded Planner */}
      {tab === "editor" && (
        <div className="card" style={{ padding: 0, overflow: "hidden" }}>
          <iframe
            src="/planner.html"
            style={{
              width: "100%",
              height: "calc(100vh - 200px)",
              border: "none",
              borderRadius: "8px",
              background: "#fff",
            }}
            title="Instant Ticket Planner"
          />
        </div>
      )}

      {/* Summary Tab — Read-Only Overview */}
      {tab === "summary" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* KPI Row */}
          <div className="kpi-grid">
            <div className="kpi-card kpi-blue">
              <div className="kpi-label">Projected Revenue</div>
              <div className="kpi-value">{fmt$(totalRevenue)}</div>
              <div className="kpi-subtitle">{fmtUnits(games.reduce((s, g) => s + Number(g.units), 0))} total units</div>
            </div>
            <div className="kpi-card kpi-gold">
              <div className="kpi-label">Wtd Avg Payout</div>
              <div className="kpi-value">{weightedPayout.toFixed(1)}%</div>
              <div className="kpi-subtitle">Prize expense: {fmt$(totalPrizeExpense)}</div>
            </div>
            <div className="kpi-card kpi-purple">
              <div className="kpi-label">Net Contribution</div>
              <div className="kpi-value">{fmt$(totalRevenue - totalPrizeExpense)}</div>
              <div className="kpi-subtitle">Before commissions & admin</div>
            </div>
            <div className="kpi-card" style={{ borderLeft: "4px solid #ef4444" }}>
              <div className="kpi-label">Marketing Budget</div>
              <div className="kpi-value">{fmt$(totalMarketingCost)}</div>
              <div className="kpi-subtitle">{marketingItems.length} line items</div>
            </div>
          </div>

          {/* Two-column: Vendor Allocation + Pipeline */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div className="card">
              <div className="card-header"><h3>Vendor Allocation</h3></div>
              <div className="card-body">
                <table className="data-table">
                  <thead><tr><th>Vendor</th><th>Games</th><th>Units</th><th>Revenue</th><th>Share</th></tr></thead>
                  <tbody>
                    {Object.entries(vendorAlloc).sort((a, b) => b[1].revenue - a[1].revenue).map(([name, data]) => (
                      <tr key={name}>
                        <td style={{ fontWeight: 500 }}>{name}</td>
                        <td>{data.games}</td>
                        <td>{fmtUnits(data.units)}</td>
                        <td>{fmt$(data.revenue)}</td>
                        <td>{((data.revenue / totalRevenue) * 100).toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
            <div className="card">
              <div className="card-header"><h3>Delivery Pipeline</h3></div>
              <div className="card-body">
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {Object.entries(pipeline).map(([status, count]) => (
                    <div key={status} style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <div style={{ width: "120px", textTransform: "capitalize", fontSize: "13px", color: "var(--text-muted)" }}>{status.replace(/_/g, " ")}</div>
                      <div style={{ flex: 1, background: "var(--bg-secondary)", borderRadius: "4px", height: "24px", overflow: "hidden" }}>
                        <div style={{ width: `${games.length > 0 ? (count / games.length) * 100 : 0}%`, height: "100%", background: STATUS_COLORS[status], borderRadius: "4px", minWidth: count > 0 ? "24px" : "0", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: 600, color: "#fff" }}>
                          {count > 0 ? count : ""}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Game Roster */}
          <div className="card">
            <div className="card-header"><h3>Game Roster — {scenario?.name || "Base Plan"}</h3></div>
            <div className="card-body">
              {Object.entries(gamesByDenom).sort(([a], [b]) => parseInt(a) - parseInt(b)).map(([denom, denomGames]) => (
                <div key={denom} style={{ marginBottom: "24px" }}>
                  <h4 style={{ color: "var(--primary)", marginBottom: "8px", borderBottom: "1px solid var(--border)", paddingBottom: "4px" }}>${denom} Games ({denomGames.length})</h4>
                  <table className="data-table">
                    <thead><tr><th>Game #</th><th>Name</th><th>Vendor</th><th>Units</th><th>Payout %</th><th>Top Prize</th><th>Launch</th><th>Status</th></tr></thead>
                    <tbody>
                      {denomGames.map(g => (
                        <tr key={g.id} style={g.deliveryStatus === 'ended' ? { opacity: 0.5 } : {}}>
                          <td className="muted">{g.gameNumber}</td>
                          <td style={{ fontWeight: 500 }}>{g.name}</td>
                          <td className="muted">{g.vendor?.name?.split(" ")[0] || "—"}</td>
                          <td>{fmtUnits(g.units)}</td>
                          <td>{parseFloat(g.payoutPercent).toFixed(1)}%</td>
                          <td>{g.topPrize ? fmt$(g.topPrize) : "—"}</td>
                          <td className="muted" style={{ fontSize: "12px" }}>{g.launchDate ? new Date(g.launchDate).toLocaleDateString() : "—"}</td>
                          <td>
                            <span style={{ padding: "2px 8px", borderRadius: "4px", fontSize: "11px", fontWeight: 600, background: (STATUS_COLORS[g.deliveryStatus] || "#6b7280") + "22", color: STATUS_COLORS[g.deliveryStatus] || "#6b7280", textTransform: "capitalize" }}>
                              {g.deliveryStatus.replace(/_/g, " ")}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
