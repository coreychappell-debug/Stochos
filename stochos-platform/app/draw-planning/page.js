'use client';

import { useState, useEffect } from "react";
import Sidebar from "../components/Sidebar";
import Link from "next/link";
import Skeleton from "../components/Skeleton";
import { Save, AlertTriangle, CheckCircle2, Trash2 } from "lucide-react";

export default function DrawPlanningPage() {
  const [scenario, setScenario] = useState(null);
  const [games, setGames] = useState([]);
  const [productsList, setProductsList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fiscalYear, setFiscalYear] = useState(2027);

  // Fetch products and active scenario
  useEffect(() => {
    async function init() {
      try {
        setLoading(true);
        setError("");

        // Get Product Catalog (to link Products)
        const prodRes = await fetch("/api/products");
        if (prodRes.ok) {
          const prods = await prodRes.json();
          // Filter to draw_game category
          setProductsList(prods.filter(p => p.category === "draw_game"));
        }

        // Get Draw Scenario
        const scenarioRes = await fetch(`/api/draw-games?fiscalYear=${fiscalYear}`);
        if (scenarioRes.ok) {
          const data = await scenarioRes.json();
          setScenario(data);
          setGames(data.games || []);
        } else {
          setError("Failed to load draw planning scenario.");
        }
      } catch (err) {
        console.error(err);
        setError("Error loading data from server.");
      } finally {
        setLoading(false);
      }
    }

    init();
  }, [fiscalYear]);

  // Handle cell edit
  const handleCellChange = (index, field, value) => {
    const updated = [...games];
    if (field === "projectedSales") {
      updated[index][field] = parseFloat(value || 0);
    } else if (field === "prizePayoutPercent" || field === "retailerCommPercent") {
      updated[index][field] = parseFloat(value || 0);
    } else {
      updated[index][field] = value;
    }
    setGames(updated);
  };

  // Add Custom Game
  const handleAddGame = () => {
    const newGame = {
      id: `temp-${Date.now()}`,
      productId: "",
      name: "New Custom Game",
      projectedSales: 10000000.00,
      prizePayoutPercent: 50.0,
      retailerCommPercent: 6.0
    };
    setGames([...games, newGame]);
  };

  // Link to Product catalog selection
  const handleProductSelect = (index, prodId) => {
    const selected = productsList.find(p => p.id === prodId);
    if (!selected) return;

    const updated = [...games];
    updated[index].productId = prodId;
    updated[index].name = selected.name;
    setGames(updated);
  };

  // Remove Game
  const handleRemoveGame = (index) => {
    const updated = games.filter((_, i) => i !== index);
    setGames(updated);
  };

  // Save Scenario
  const handleSave = async () => {
    if (!scenario) return;
    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const res = await fetch("/api/draw-games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          scenarioId: scenario.id,
          games: games.map(g => ({
            productId: g.productId || null,
            name: g.name,
            projectedSales: g.projectedSales,
            prizePayoutPercent: g.prizePayoutPercent,
            retailerCommPercent: g.retailerCommPercent
          }))
        })
      });

      if (res.ok) {
        setSuccess("Draw planning scenario saved successfully!");
        const data = await res.json();
        // Refresh games with DB ids
        if (data.games) {
          setGames(data.games);
        }
      } else {
        const errData = await res.json();
        setError(errData.error || "Failed to save draw scenario.");
      }
    } catch (err) {
      console.error(err);
      setError("Network error: failed to save.");
    } finally {
      setSaving(false);
    }
  };

  // Calculate Metrics
  const totalSales = games.reduce((acc, g) => acc + (g.projectedSales || 0), 0);
  const totalPrizeExpense = games.reduce((acc, g) => acc + ((g.projectedSales || 0) * (g.prizePayoutPercent || 0) / 100), 0);
  const totalRetailerComm = games.reduce((acc, g) => acc + ((g.projectedSales || 0) * (g.retailerCommPercent || 0) / 100), 0);
  const blendedPayout = totalSales > 0 ? (totalPrizeExpense / totalSales) * 100 : 0;
  const netContribution = totalSales - (totalPrizeExpense + totalRetailerComm);

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
          <div>
            <h1 style={{ fontSize: "28px", fontWeight: "800", color: "var(--text)", margin: 0, letterSpacing: "-0.5px" }}>
              Draw Game Revenue Planner
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginTop: "4px", margin: 0 }}>
              Model projected sales and prize payouts for core and custom draw games.
            </p>
          </div>
          <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)" }}>Fiscal Year:</label>
            <select 
              value={fiscalYear} 
              onChange={(e) => setFiscalYear(parseInt(e.target.value, 10))}
              style={{ padding: "6px 12px", border: "1px solid var(--border)", borderRadius: "6px", backgroundColor: "var(--surface-3)", color: "var(--text)" }}
            >
              <option value={2026}>FY2026</option>
              <option value={2027}>FY2027 (Current)</option>
              <option value={2028}>FY2028</option>
            </select>
            <button 
              onClick={handleSave} 
              disabled={saving || loading}
              className="btn btn-primary"
              style={{ minWidth: 120, display: "inline-flex", alignItems: "center", justifyContent: "center" }}
            >
              {saving ? (
                <>
                  <svg className="animate-spin" viewBox="0 0 24 24" style={{ width: '12px', height: '12px', marginRight: '6px', fill: 'none', stroke: 'currentColor', strokeWidth: '3px' }}>
                    <circle cx="12" cy="12" r="10" stroke="currentColor" opacity="0.25" />
                    <path d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" fill="currentColor" stroke="none" />
                  </svg>
                  Saving...
                </>
              ) : (
                <span style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  <Save size={14} /> Save Plan
                </span>
              )}
            </button>
          </div>
        </div>

        {error && (
          <div style={{ padding: "12px", backgroundColor: "#fef2f2", color: "#b91c1c", borderRadius: "6px", border: "1px solid #fee2e2", marginBottom: "1.5rem", fontSize: 14, display: "flex", alignItems: "center", gap: "8px" }}>
            <AlertTriangle size={16} /> {error}
          </div>
        )}

        {success && (
          <div style={{ padding: "12px", backgroundColor: "#f0fdf4", color: "#166534", borderRadius: "6px", border: "1px solid #dcfce7", marginBottom: "1.5rem", fontSize: 14, display: "flex", alignItems: "center", gap: "8px" }}>
            <CheckCircle2 size={16} style={{ color: "#166534" }} /> {success}
          </div>
        )}

        {loading ? (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            {/* Shimmering KPI grid */}
            <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
              {[1, 2, 3, 4].map((i) => (
                <div className="kpi-card" style={{ padding: "20px" }} key={i}>
                  <Skeleton width="60%" height="12px" style={{ marginBottom: "12px" }} />
                  <Skeleton width="85%" height="28px" style={{ marginBottom: "8px" }} />
                  <Skeleton width="50%" height="10px" />
                </div>
              ))}
            </div>

            {/* Shimmering Table */}
            <div className="card">
              <div className="card-header">
                <Skeleton width="160px" height="16px" />
              </div>
              <div className="card-body" style={{ padding: "20px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {/* Table headers */}
                  <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border)", paddingBottom: "12px" }}>
                    <Skeleton width="12%" height="14px" />
                    <Skeleton width="18%" height="14px" />
                    <Skeleton width="12%" height="14px" />
                    <Skeleton width="10%" height="14px" />
                    <Skeleton width="12%" height="14px" />
                    <Skeleton width="10%" height="14px" />
                    <Skeleton width="12%" height="14px" />
                    <Skeleton width="6%" height="14px" />
                  </div>
                  {/* Table rows */}
                  {[1, 2, 3, 4].map((row) => (
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }} key={row}>
                      <Skeleton width="12%" height="16px" />
                      <Skeleton width="18%" height="16px" />
                      <Skeleton width="12%" height="16px" />
                      <Skeleton width="10%" height="16px" />
                      <Skeleton width="12%" height="16px" />
                      <Skeleton width="10%" height="16px" />
                      <Skeleton width="12%" height="16px" />
                      <Skeleton width="6%" height="16px" />
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            
            {/* KPI Dashboard cards */}
            <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))" }}>
              <div className="kpi-card kpi-blue">
                <div className="kpi-label">Projected Draw Sales</div>
                <div className="kpi-value">${totalSales.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                <div className="kpi-subtitle">Total gross revenue</div>
              </div>
              <div className="kpi-card kpi-purple">
                <div className="kpi-label">Projected Prize Expense</div>
                <div className="kpi-value">${totalPrizeExpense.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                <div className="kpi-subtitle">Blended Payout: {blendedPayout.toFixed(2)}%</div>
              </div>
              <div className="kpi-card kpi-gold">
                <div className="kpi-label">Retailer Commissions</div>
                <div className="kpi-value">${totalRetailerComm.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                <div className="kpi-subtitle">Average: 6.00%</div>
              </div>
              <div className="kpi-card kpi-green">
                <div className="kpi-label">Net Contribution</div>
                <div className="kpi-value">${netContribution.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
                <div className="kpi-subtitle">Revenue net of prizes/commission</div>
              </div>
            </div>

            {/* Main Interactive Table Grid */}
            <div className="card" style={{ background: "var(--card-bg)" }}>
              <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <h3 style={{ margin: 0 }}>Projected Roster</h3>
                <button 
                  onClick={handleAddGame}
                  className="btn"
                  style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6, backgroundColor: "var(--surface-3)", border: "1px solid var(--border)", color: "var(--text)" }}
                >
                  <span>+</span> Add Custom Draw Game
                </button>
              </div>
              <div className="card-body" style={{ padding: 0, overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", color: "var(--text)", fontSize: 13 }}>
                  <thead>
                    <tr style={{ backgroundColor: "var(--surface-3)", borderBottom: "1px solid var(--border)" }}>
                      <th style={{ textAlign: "left", padding: "12px 16px" }}>Linked Product</th>
                      <th style={{ textAlign: "left", padding: "12px 16px" }}>Game Name</th>
                      <th style={{ textAlign: "right", padding: "12px 16px" }}>Projected Annual Sales ($)</th>
                      <th style={{ textAlign: "right", padding: "12px 16px" }}>Prize Payout %</th>
                      <th style={{ textAlign: "right", padding: "12px 16px" }}>Projected Prize Expense ($)</th>
                      <th style={{ textAlign: "right", padding: "12px 16px" }}>Retailer Comm %</th>
                      <th style={{ textAlign: "right", padding: "12px 16px" }}>Net Revenue Contribution ($)</th>
                      <th style={{ textAlign: "center", padding: "12px 16px", width: 60 }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {games.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ textAlign: "center", padding: "32px", color: "var(--text-secondary)" }}>
                          No draw games added yet. Click &quot;Add Custom Draw Game&quot; to begin.
                        </td>
                      </tr>
                    ) : (
                      games.map((game, index) => {
                        const payoutAmt = (game.projectedSales * game.prizePayoutPercent) / 100;
                        const commAmt = (game.projectedSales * game.retailerCommPercent) / 100;
                        const netAmt = game.projectedSales - (payoutAmt + commAmt);

                        return (
                          <tr key={game.id} style={{ borderBottom: "1px solid var(--border)", verticalAlign: "middle" }}>
                            {/* Product Link Select */}
                            <td style={{ padding: "10px 16px", minWidth: 160 }}>
                              <select
                                value={game.productId || ""}
                                onChange={(e) => handleProductSelect(index, e.target.value)}
                                style={{ width: "100%", padding: "6px", borderRadius: "4px", backgroundColor: "var(--surface-3)", border: "1px solid var(--border)", color: "var(--text)", fontSize: 13 }}
                              >
                                <option value="">-- Custom (Unlinked) --</option>
                                {productsList.map(p => (
                                  <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                              </select>
                            </td>
                            {/* Name Input */}
                            <td style={{ padding: "10px 16px" }}>
                              <input 
                                type="text"
                                value={game.name}
                                onChange={(e) => handleCellChange(index, "name", e.target.value)}
                                disabled={!!game.productId}
                                style={{ width: "100%", padding: "6px", borderRadius: "4px", backgroundColor: game.productId ? "transparent" : "var(--surface-3)", border: game.productId ? "none" : "1px solid var(--border)", color: "var(--text)", fontSize: 13, fontWeight: game.productId ? "bold" : "normal" }}
                              />
                            </td>
                            {/* Projected Sales */}
                            <td style={{ padding: "10px 16px", textAlign: "right" }}>
                              <input 
                                type="number"
                                value={game.projectedSales}
                                onChange={(e) => handleCellChange(index, "projectedSales", e.target.value)}
                                style={{ width: 120, padding: "6px", textAlign: "right", borderRadius: "4px", backgroundColor: "var(--surface-3)", border: "1px solid var(--border)", color: "var(--text)", fontSize: 13 }}
                              />
                            </td>
                            {/* Prize Payout % */}
                            <td style={{ padding: "10px 16px", textAlign: "right" }}>
                              <input 
                                type="number"
                                step="0.1"
                                value={game.prizePayoutPercent}
                                onChange={(e) => handleCellChange(index, "prizePayoutPercent", e.target.value)}
                                style={{ width: 80, padding: "6px", textAlign: "right", borderRadius: "4px", backgroundColor: "var(--surface-3)", border: "1px solid var(--border)", color: "var(--text)", fontSize: 13 }}
                              />
                            </td>
                            {/* Prize Expense Calc */}
                            <td style={{ padding: "10px 16px", textAlign: "right", fontFamily: "var(--font-mono)", fontWeight: 600 }}>
                              ${payoutAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            {/* Retailer Comm % */}
                            <td style={{ padding: "10px 16px", textAlign: "right" }}>
                              <input 
                                type="number"
                                step="0.1"
                                value={game.retailerCommPercent}
                                onChange={(e) => handleCellChange(index, "retailerCommPercent", e.target.value)}
                                style={{ width: 70, padding: "6px", textAlign: "right", borderRadius: "4px", backgroundColor: "var(--surface-3)", border: "1px solid var(--border)", color: "var(--text)", fontSize: 13 }}
                              />
                            </td>
                            {/* Net revenue contribution */}
                            <td style={{ padding: "10px 16px", textAlign: "right", fontFamily: "var(--font-mono)", color: "var(--green)", fontWeight: 700 }}>
                              ${netAmt.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            {/* Actions */}
                            <td style={{ padding: "10px 16px", textAlign: "center" }}>
                              <button 
                                onClick={() => handleRemoveGame(index)}
                                style={{ color: "#ef4444", background: "none", border: "none", cursor: "pointer", display: "inline-flex", alignItems: "center", padding: "4px" }}
                                title="Remove game"
                              >
                                <Trash2 size={16} />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>

          </div>
        )}
      </main>
    </div>
  );
}
