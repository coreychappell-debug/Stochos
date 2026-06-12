"use client";
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileText, BarChart4, Settings2, Info } from "lucide-react";

export default function PlanDetailClient({ plan, stats }) {
  const [tab, setTab] = useState("editor");
  const [saving, setSaving] = useState(false);
  const [allocationBasis, setAllocationBasis] = useState("sales");
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
    if (isNaN(num)) return "—";
    if (num >= 1_000_000_000) return "$" + (num / 1_000_000_000).toFixed(2) + "B";
    if (num >= 1_000_000) return "$" + (num / 1_000_000).toFixed(1) + "M";
    return "$" + num.toLocaleString("en-US", { maximumFractionDigits: 0 });
  }

  function fmtUnits(val) {
    const num = Number(val);
    if (isNaN(num)) return "—";
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + "M";
    if (num >= 1_000) return (num / 1_000).toFixed(0) + "K";
    return num.toString();
  }

  const { totalRevenue, totalPrizeExpense, weightedPayout, totalMarketingCost, vendorAlloc, pipeline, gamesByDenom, marketingItems, games, scenario } = stats;

  const hasAllocation = !!(stats.salesBasis && stats.volumeBasis);
  const activeBasis = hasAllocation ? (allocationBasis === "sales" ? stats.salesBasis : stats.volumeBasis) : null;

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
                style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <CheckCircle2 size={14} /> Approve Plan
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ display: "flex", gap: "0", borderBottom: "2px solid var(--border)", marginBottom: "16px" }}>
        {[
          { key: "editor", label: "Edit Plan", icon: <FileText size={14} /> },
          { key: "summary", label: "Summary", icon: <BarChart4 size={14} /> },
        ].map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            style={{
              padding: "10px 24px",
              background: tab === t.key ? "var(--card-bg)" : "transparent",
              color: tab === t.key ? "var(--blue)" : "var(--text-muted)",
              border: "none",
              borderBottom: tab === t.key ? "2px solid var(--blue)" : "2px solid transparent",
              marginBottom: "-2px",
              cursor: "pointer",
              fontWeight: tab === t.key ? 600 : 400,
              fontSize: "14px",
              transition: "all 0.2s ease",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px"
            }}
          >
            {t.icon}
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
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          
          {/* Allocation Basis Controls */}
          {hasAllocation && (
            <div className="card" style={{ padding: "16px", background: "var(--card-bg)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Settings2 size={18} style={{ color: "var(--blue)" }} />
                  <span style={{ fontWeight: 600, fontSize: "14px" }}>Shared Expense Allocation Rules</span>
                </div>
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    onClick={() => setAllocationBasis("sales")}
                    style={{
                      padding: "6px 16px",
                      borderRadius: "4px",
                      fontSize: "13px",
                      fontWeight: 600,
                      cursor: "pointer",
                      border: "1px solid var(--border)",
                      background: allocationBasis === "sales" ? "var(--blue)" : "var(--surface-3)",
                      color: allocationBasis === "sales" ? "#fff" : "var(--text-muted)",
                      transition: "all 0.2s"
                    }}
                  >
                    Allocate by Gross Sales
                  </button>
                  <button
                    onClick={() => setAllocationBasis("volume")}
                    style={{
                      padding: "6px 16px",
                      borderRadius: "4px",
                      fontSize: "13px",
                      fontWeight: 600,
                      cursor: "pointer",
                      border: "1px solid var(--border)",
                      background: allocationBasis === "volume" ? "var(--blue)" : "var(--surface-3)",
                      color: allocationBasis === "volume" ? "#fff" : "var(--text-muted)",
                      transition: "all 0.2s"
                    }}
                  >
                    Allocate by Ticket Volume (Units)
                  </button>
                </div>
              </div>
              <div style={{ marginTop: "12px", fontSize: "13px", color: "var(--text-muted)", display: "flex", alignItems: "flex-start", gap: "6px" }}>
                <Info size={16} style={{ color: "var(--blue)", flexShrink: 0, marginTop: "2px" }} />
                <span>
                  {allocationBasis === "sales" 
                    ? "Central overhead contracts are divided proportionally between Instant Tickets and Draw Games based on total projected gross sales, then allocated to individual scratcher games based on their share of gross sales." 
                    : "Central overhead contracts are divided proportionally between Instant Tickets and Draw Games based on total projected gross sales, then allocated to individual scratcher games based on their share of printed ticket units."
                  }
                </span>
              </div>
            </div>
          )}

          {/* KPI Row */}
          <div className="kpi-grid">
            <div className="kpi-card kpi-blue">
              <div className="kpi-label">Projected Scratcher Sales</div>
              <div className="kpi-value">{fmt$(activeBasis ? activeBasis.summary.totalInstantSales : totalRevenue)}</div>
              <div className="kpi-subtitle">
                {fmtUnits(activeBasis ? activeBasis.summary.totalInstantUnits : games.reduce((s, g) => s + Number(g.units), 0))} printed units
              </div>
            </div>
            <div className="kpi-card kpi-gold">
              <div className="kpi-label">Weighted Payout</div>
              <div className="kpi-value">{weightedPayout.toFixed(1)}%</div>
              <div className="kpi-subtitle">Prize expense: {fmt$(activeBasis ? activeBasis.summary.totalInstantPrizeExpense : totalPrizeExpense)}</div>
            </div>
            
            {/* Fully Loaded Profitability KPI */}
            {hasAllocation ? (
              <div className="kpi-card kpi-purple">
                <div className="kpi-label">Fully Loaded Net Margin</div>
                <div className="kpi-value">
                  {(() => {
                    const sales = activeBasis.summary.totalInstantSales;
                    const prizes = activeBasis.summary.totalInstantPrizeExpense;
                    const comm = activeBasis.summary.totalInstantRetailerComm;
                    const print = activeBasis.summary.totalInstantPrintingCost;
                    const overhead = activeBasis.summary.instantTicketShareOfCentralOverhead;
                    const loadedProfit = sales - prizes - comm - print - overhead;
                    const loadedMargin = sales > 0 ? (loadedProfit / sales) * 100 : 0;
                    return `${loadedMargin.toFixed(1)}%`;
                  })()}
                </div>
                <div className="kpi-subtitle">
                  Net Loaded Profit: {(() => {
                    const sales = activeBasis.summary.totalInstantSales;
                    const prizes = activeBasis.summary.totalInstantPrizeExpense;
                    const comm = activeBasis.summary.totalInstantRetailerComm;
                    const print = activeBasis.summary.totalInstantPrintingCost;
                    const overhead = activeBasis.summary.instantTicketShareOfCentralOverhead;
                    const loadedProfit = sales - prizes - comm - print - overhead;
                    return fmt$(loadedProfit);
                  })()}
                </div>
              </div>
            ) : (
              <div className="kpi-card kpi-purple">
                <div className="kpi-label">Net Contribution</div>
                <div className="kpi-value">{fmt$(totalRevenue - totalPrizeExpense)}</div>
                <div className="kpi-subtitle">Before commissions & admin</div>
              </div>
            )}

            <div className="kpi-card" style={{ borderLeft: "4px solid #ef4444" }}>
              <div className="kpi-label">Direct Marketing Spend</div>
              <div className="kpi-value">{fmt$(totalMarketingCost)}</div>
              <div className="kpi-subtitle">{marketingItems.length} line items</div>
            </div>
          </div>

          {/* Allocation Breakdown and Method Math */}
          {hasAllocation && (
            <div style={{ display: "grid", gridTemplateColumns: "1.2fr 0.8fr", gap: "16px" }}>
              
              {/* Central Overhead Contracts List */}
              <div className="card">
                <div className="card-header">
                  <h3>Central Operations Overhead Contracts</h3>
                </div>
                <div className="card-body">
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>Contract Title</th>
                        <th>Type</th>
                        <th style={{ textAlign: "right" }}>Annual Value</th>
                        <th style={{ textAlign: "right" }}>Allocated to Scratchers</th>
                      </tr>
                    </thead>
                    <tbody>
                      {activeBasis.contracts.map((c) => (
                        <tr key={c.id}>
                          <td style={{ fontWeight: 500, fontSize: "13px" }}>{c.title}</td>
                          <td className="muted" style={{ textTransform: "capitalize", fontSize: "12px" }}>
                            {c.type.replace(/_/g, " ")}
                          </td>
                          <td style={{ textAlign: "right", fontFamily: "monospace" }}>{fmt$(c.annualCost)}</td>
                          <td style={{ textAlign: "right", fontFamily: "monospace", color: "var(--blue)", fontWeight: 600 }}>
                            {fmt$(c.allocatedToInstant)}
                          </td>
                        </tr>
                      ))}
                      <tr style={{ borderTop: "2px solid var(--border)", fontWeight: "bold" }}>
                        <td>Total Central Overhead</td>
                        <td></td>
                        <td style={{ textAlign: "right", fontFamily: "monospace" }}>
                          {fmt$(activeBasis.summary.totalCentralOverhead)}
                        </td>
                        <td style={{ textAlign: "right", fontFamily: "monospace", color: "var(--blue)" }}>
                          {fmt$(activeBasis.summary.instantTicketShareOfCentralOverhead)}
                        </td>
                      </tr>
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Allocation Formula Explainer */}
              <div className="card" style={{ display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
                <div className="card-header">
                  <h3>Proportional Share Formula</h3>
                </div>
                <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "13px" }}>
                  <div style={{ padding: "12px", background: "var(--surface-3)", borderRadius: "6px", border: "1px solid var(--border)" }}>
                    <div style={{ fontWeight: 600, color: "var(--text-muted)", marginBottom: "4px" }}>Step 1: Game Type Split</div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>Projected Scratcher Sales:</span>
                      <span style={{ fontWeight: 600 }}>{fmt$(activeBasis.summary.totalInstantSales)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span>Projected Draw Sales:</span>
                      <span style={{ fontWeight: 600 }}>{fmt$(activeBasis.summary.totalDrawSales)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--border)", paddingTop: "4px", marginTop: "4px", fontWeight: "bold" }}>
                      <span>Total Lottery Sales:</span>
                      <span>{fmt$(activeBasis.summary.totalLotterySales)}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", color: "var(--blue)", fontWeight: 600, marginTop: "6px" }}>
                      <span>Scratcher Ratio:</span>
                      <span>{(activeBasis.summary.instantShareFraction * 100).toFixed(1)}%</span>
                    </div>
                  </div>

                  <div style={{ padding: "12px", background: "var(--surface-3)", borderRadius: "6px", border: "1px solid var(--border)" }}>
                    <div style={{ fontWeight: 600, color: "var(--text-muted)", marginBottom: "4px" }}>Step 2: Scratcher Cost Allocation</div>
                    <div>
                      <span>Scratcher Share of Overhead:</span>
                      <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--blue)", marginTop: "4px" }}>
                        {fmt$(activeBasis.summary.instantTicketShareOfCentralOverhead)}
                      </div>
                      <div style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                        ({(activeBasis.summary.instantShareFraction * 100).toFixed(1)}% of {fmt$(activeBasis.summary.totalCentralOverhead)} total central overhead)
                      </div>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          )}

          {/* Two-column: Vendor Allocation + Pipeline */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div className="card">
              <div className="card-header"><h3>Vendor Allocation</h3></div>
              <div className="card-body">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Vendor</th>
                      <th>Games</th>
                      <th>Units</th>
                      <th>Revenue</th>
                      <th>Share</th>
                    </tr>
                  </thead>
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
                      <div style={{ flex: 1, background: "var(--surface-3)", borderRadius: "4px", height: "24px", overflow: "hidden" }}>
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
            <div className="card-header">
              <h3>Game Roster & Fully Loaded Profitability — {scenario?.name || "Base Plan"}</h3>
            </div>
            <div className="card-body">
              {Object.entries(gamesByDenom).sort(([a], [b]) => parseInt(a) - parseInt(b)).map(([denom, denomGames]) => {
                const enrichedDenomGames = denomGames.map(dg => {
                  const matchingEnrichedGame = activeBasis?.games.find(eg => eg.id === dg.id);
                  return matchingEnrichedGame || {
                    ...dg,
                    grossSales: Number(dg.units) * Number(dg.denomination) * (parseFloat(plan.sellThroughPct) / 100.0),
                    prizeExpense: Number(dg.units) * Number(dg.denomination) * (parseFloat(plan.sellThroughPct) / 100.0) * (parseFloat(dg.payoutPercent) / 100.0),
                    retailerCommission: Number(dg.units) * Number(dg.denomination) * (parseFloat(plan.sellThroughPct) / 100.0) * (parseFloat(plan.retailerCommPct) / 100.0),
                    printingCost: Number(dg.units) * 0.022,
                    allocatedOverhead: 0,
                    fullyLoadedProfit: 0,
                    fullyLoadedMargin: 0
                  };
                });

                return (
                  <div key={denom} style={{ marginBottom: "24px" }}>
                    <h4 style={{ color: "var(--blue)", marginBottom: "8px", borderBottom: "1px solid var(--border)", paddingBottom: "4px" }}>
                      ${denom} Games ({denomGames.length})
                    </h4>
                    <div style={{ overflowX: "auto" }}>
                      <table className="data-table">
                        <thead>
                          {hasAllocation ? (
                            <tr>
                              <th>Game #</th>
                              <th>Name</th>
                              <th>Units</th>
                              <th style={{ textAlign: "right" }}>Projected Sales</th>
                              <th style={{ textAlign: "right" }}>Prizes</th>
                              <th style={{ textAlign: "right" }}>Comms</th>
                              <th style={{ textAlign: "right" }}>Print Cost</th>
                              <th style={{ textAlign: "right" }}>Alloc Overhead</th>
                              <th style={{ textAlign: "right" }}>Loaded Profit</th>
                              <th style={{ textAlign: "right" }}>Loaded Margin</th>
                              <th>Status</th>
                            </tr>
                          ) : (
                            <tr>
                              <th>Game #</th>
                              <th>Name</th>
                              <th>Vendor</th>
                              <th>Units</th>
                              <th>Payout %</th>
                              <th>Top Prize</th>
                              <th>Launch</th>
                              <th>Status</th>
                            </tr>
                          )}
                        </thead>
                        <tbody>
                          {enrichedDenomGames.map(g => (
                            <tr key={g.id} style={g.deliveryStatus === 'ended' ? { opacity: 0.5 } : {}}>
                              <td className="muted">{g.gameNumber}</td>
                              <td style={{ fontWeight: 600 }}>{g.name}</td>
                              
                              {hasAllocation ? (
                                <>
                                  <td className="muted">{fmtUnits(g.units)}</td>
                                  <td style={{ textAlign: "right", fontFamily: "monospace" }}>{fmt$(g.grossSales)}</td>
                                  <td style={{ textAlign: "right", fontFamily: "monospace", color: "#b91c1c" }}>-{fmt$(g.prizeExpense)}</td>
                                  <td style={{ textAlign: "right", fontFamily: "monospace", color: "#b91c1c" }}>-{fmt$(g.retailerCommission)}</td>
                                  <td style={{ textAlign: "right", fontFamily: "monospace", color: "#b91c1c" }}>-{fmt$(g.printingCost)}</td>
                                  <td style={{ textAlign: "right", fontFamily: "monospace", color: "#b91c1c" }}>-{fmt$(g.allocatedOverhead)}</td>
                                  <td style={{ textAlign: "right", fontFamily: "monospace", color: g.fullyLoadedProfit >= 0 ? "#15803d" : "#b91c1c", fontWeight: "bold" }}>
                                    {fmt$(g.fullyLoadedProfit)}
                                  </td>
                                  <td style={{ textAlign: "right", fontWeight: 600, color: g.fullyLoadedMargin >= 15 ? "#15803d" : (g.fullyLoadedMargin >= 5 ? "#b45309" : "#b91c1c") }}>
                                    {g.fullyLoadedMargin.toFixed(1)}%
                                  </td>
                                </>
                              ) : (
                                <>
                                  <td className="muted">{g.vendor?.name?.split(" ")[0] || "—"}</td>
                                  <td>{fmtUnits(g.units)}</td>
                                  <td>{parseFloat(g.payoutPercent).toFixed(1)}%</td>
                                  <td>{g.topPrize ? fmt$(g.topPrize) : "—"}</td>
                                  <td className="muted" style={{ fontSize: "12px" }}>{g.launchDate ? new Date(g.launchDate).toLocaleDateString() : "—"}</td>
                                </>
                              )}

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
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </>
  );
}
