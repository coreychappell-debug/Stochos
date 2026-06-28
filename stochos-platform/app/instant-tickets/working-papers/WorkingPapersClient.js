"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileText, Search, Plus, Trash2, CheckCircle2, AlertCircle, HelpCircle } from "lucide-react";

export default function WorkingPapersClient({ workingPapers, plannedGames }) {
  const router = useRouter();
  const [papers, setPapers] = useState(workingPapers);
  const [searchQuery, setSearchQuery] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form State
  const [creationType, setCreationType] = useState("planned"); // "planned" or "manual"
  const [selectedGameId, setSelectedGameId] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualNumber, setManualNumber] = useState("");
  const [manualDenom, setManualDenom] = useState(5);
  const [manualPrintRun, setManualPrintRun] = useState(10000000);
  const [manualPayout, setManualPayout] = useState(65);

  // Filter papers
  const filteredPapers = papers.filter(p => {
    const q = searchQuery.toLowerCase();
    return (
      p.name.toLowerCase().includes(q) ||
      p.gameNumber.toLowerCase().includes(q)
    );
  });

  // KPI Calculations
  const totalCount = papers.length;
  const executedCount = papers.filter(p => p.status === "executed").length;
  const draftCount = papers.filter(p => p.status === "draft").length;

  const handleGameSelect = (e) => {
    const id = e.target.value;
    setSelectedGameId(id);
    if (!id) return;

    const game = plannedGames.find(g => g.id === id);
    if (game) {
      setManualName(game.name);
      setManualNumber(game.gameNumber);
      setManualDenom(game.denomination);
      setManualPrintRun(Number(game.units));
      setManualPayout(parseFloat(game.payoutPercent));
    }
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const plannedGame = creationType === "planned" ? plannedGames.find(g => g.id === selectedGameId) : null;
      const plannedPrizeExpense = (manualPrintRun * manualDenom * (manualPayout / 100));

      const payload = {
        gameId: creationType === "planned" ? selectedGameId : null,
        name: manualName,
        gameNumber: manualNumber,
        denomination: manualDenom,
        printRun: manualPrintRun,
        plannedPrizeExpense: plannedPrizeExpense,
        overallOdds: 100 / (manualPayout / 2.5), // Estimate initial odds
        status: "draft"
      };

      const res = await fetch("/api/instant-tickets/working-papers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to create working paper");
      }

      const newPaper = await res.json();
      setShowCreateModal(false);
      router.push(`/instant-tickets/working-papers/${newPaper.id}`);
    } catch (err) {
      alert(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Are you sure you want to delete the working paper for ${name}?`)) return;

    try {
      const res = await fetch(`/api/instant-tickets/working-papers/${id}`, {
        method: "DELETE"
      });

      if (res.ok) {
        setPapers(papers.filter(p => p.id !== id));
      } else {
        alert("Failed to delete working paper.");
      }
    } catch (err) {
      console.error(err);
      alert("Error deleting working paper.");
    }
  };

  function fmt$(val) {
    if (val === undefined || val === null) return "—";
    const num = parseFloat(val);
    if (num >= 1_000_000_000) return "$" + (num / 1_000_000_000).toFixed(2) + "B";
    if (num >= 1_000_000) return "$" + (num / 1_000_000).toFixed(2) + "M";
    return "$" + num.toLocaleString("en-US");
  }

  function fmtUnits(val) {
    const num = Number(val);
    if (num >= 1_000_000) return (num / 1_000_000).toFixed(1) + "M";
    if (num >= 1_000) return (num / 1_000).toFixed(0) + "K";
    return num.toLocaleString("en-US");
  }

  return (
    <div>
      <div className="page-header flex justify-between items-center">
        <div>
          <h2>Working Papers Registry</h2>
          <p>NYSGC co-signed official instant game ticket printing parameters, legal rules, and prize structures.</p>
        </div>
        <div className="flex gap-2">
          <button onClick={() => setShowCreateModal(true)} className="btn btn-primary flex gap-1 items-center">
            <Plus size={16} /> New Working Paper
          </button>
        </div>
      </div>

      <div className="page-body">
        {/* KPI Row */}
        <div className="kpi-grid">
          <div className="kpi-card kpi-purple">
            <div className="kpi-label">Total Contracts</div>
            <div className="kpi-value">{totalCount}</div>
          </div>
          <div className="kpi-card kpi-blue">
            <div className="kpi-label">Executed / Co-Signed</div>
            <div className="kpi-value">{executedCount}</div>
          </div>
          <div className="kpi-card kpi-gold">
            <div className="kpi-label">In Draft</div>
            <div className="kpi-value">{draftCount}</div>
          </div>
        </div>

        {/* Filters and List */}
        <div className="card">
          <div className="card-header flex justify-between items-center" style={{ gap: "16px" }}>
            <div style={{ position: "relative", flex: 1, maxWidth: "400px" }}>
              <span style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }}>
                <Search size={16} />
              </span>
              <input
                type="text"
                placeholder="Search working papers by name or game number..."
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px 12px 8px 36px",
                  borderRadius: "6px",
                  border: "1px solid var(--border)",
                  backgroundColor: "var(--surface-3)",
                  color: "var(--text)",
                  outline: "none"
                }}
              />
            </div>
            <div className="text-sm muted">
              Showing {filteredPapers.length} of {papers.length} records
            </div>
          </div>

          <div className="card-body">
            {filteredPapers.length === 0 ? (
              <div className="empty-state">
                <div className="empty-state-icon" style={{ display: "flex", justifyContent: "center", marginBottom: "16px" }}>
                  <FileText size={48} style={{ strokeWidth: 1.5, color: "var(--text-muted)" }} />
                </div>
                <h3>No working papers found</h3>
                <p>Compile details, legal rules, and prize payout odds by creating a new contract sheet.</p>
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Game Number</th>
                    <th>Game Name</th>
                    <th>Price</th>
                    <th>Print Run</th>
                    <th>Prize Expense</th>
                    <th>Payout %</th>
                    <th>Overall Odds</th>
                    <th>Linked Plan</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPapers.map(p => {
                    const printRunNum = Number(p.printRun);
                    const grossSales = printRunNum * p.denomination;
                    const calculatedPayoutPct = grossSales > 0 ? (parseFloat(p.plannedPrizeExpense) / grossSales) * 100 : 0;

                    return (
                      <tr key={p.id}>
                        <td style={{ fontWeight: 600 }}>Game #{p.gameNumber}</td>
                        <td>
                          <Link href={`/instant-tickets/working-papers/${p.id}`} style={{ fontWeight: 500, color: "var(--primary)", textDecoration: "none" }}>
                            {p.name}
                          </Link>
                        </td>
                        <td>${p.denomination}</td>
                        <td>{fmtUnits(p.printRun)}</td>
                        <td>{fmt$(p.plannedPrizeExpense)}</td>
                        <td>
                          <span style={{ fontWeight: 600 }}>{calculatedPayoutPct.toFixed(2)}%</span>
                        </td>
                        <td>{p.overallOdds ? `1 in ${parseFloat(p.overallOdds).toFixed(2)}` : "—"}</td>
                        <td>
                          {p.game ? (
                            <span style={{
                              display: "inline-flex", gap: "6px", alignItems: "center",
                              backgroundColor: "var(--blue-dim)", color: "var(--blue)",
                              border: "1px solid var(--blue-dim)", padding: "2px 10px",
                              borderRadius: "12px", fontWeight: 600, fontSize: "11px"
                            }}>
                              <CheckCircle2 size={12} /> {p.game.scenario.plan.name}
                            </span>
                          ) : (
                            <span style={{
                              display: "inline-flex", gap: "6px", alignItems: "center",
                              backgroundColor: "var(--gold-dim)", color: "var(--gold)",
                              border: "1px solid var(--gold-dim)", padding: "2px 10px",
                              borderRadius: "12px", fontWeight: 600, fontSize: "11px"
                            }}>
                              <AlertCircle size={12} /> Standalone
                            </span>
                          )}
                        </td>
                        <td>
                          <span className={`badge ${
                            p.status === "executed" ? "badge-active" : 
                            p.status === "pending_approval" ? "badge-submitted" : "badge-draft"
                          }`}>
                            {p.status === "executed" ? "Executed" : p.status === "pending_approval" ? "Pending Approval" : "Draft"}
                          </span>
                        </td>
                        <td>
                          <div className="flex gap-2">
                            <Link href={`/instant-tickets/working-papers/${p.id}`} className="btn btn-secondary text-xs" style={{ padding: "4px 8px" }}>
                              Edit Builder
                            </Link>
                            <button
                              onClick={() => handleDelete(p.id, p.name)}
                              className="btn btn-danger text-xs"
                              style={{ padding: "4px 8px" }}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* CREATE MODAL */}
      {showCreateModal && (
        <div className="modal-overlay" style={{
          position: "fixed", top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: "rgba(0,0,0,0.6)", display: "flex", justifyContent: "center",
          alignItems: "center", zIndex: 1000, padding: "16px"
        }}>
          <div className="modal-content card" style={{
            width: "100%", maxWidth: "600px", display: "flex", flexDirection: "column",
            animation: "slideIn 0.2s ease-out", backgroundColor: "var(--surface-1)"
          }}>
            <div className="card-header flex justify-between items-center" style={{ borderBottom: "1px solid var(--border)" }}>
              <h3>Create Working Paper Contract</h3>
              <button onClick={() => setShowCreateModal(false)} className="btn btn-secondary" style={{ padding: "4px 8px" }}>×</button>
            </div>

            <form onSubmit={handleCreate}>
              <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <label className="form-label" style={{ fontWeight: 600, display: "block", marginBottom: "6px" }}>
                    Creation Mode
                  </label>
                  <div style={{ display: "flex", gap: "16px" }}>
                    <label style={{ display: "flex", gap: "8px", alignItems: "center", cursor: "pointer" }}>
                      <input
                        type="radio"
                        name="creationType"
                        value="planned"
                        checked={creationType === "planned"}
                        onChange={() => setCreationType("planned")}
                      />
                      <span>Import Planned Game from Scenario</span>
                    </label>
                    <label style={{ display: "flex", gap: "8px", alignItems: "center", cursor: "pointer" }}>
                      <input
                        type="radio"
                        name="creationType"
                        value="manual"
                        checked={creationType === "manual"}
                        onChange={() => setCreationType("manual")}
                      />
                      <span>Create Standalone / Manual</span>
                    </label>
                  </div>
                </div>

                {creationType === "planned" ? (
                  <div>
                    <label className="form-label" style={{ fontWeight: 600, display: "block", marginBottom: "6px" }}>
                      Select Planned Game
                    </label>
                    {plannedGames.length === 0 ? (
                      <div className="alert alert-warning text-sm" style={{ padding: "10px", borderRadius: "6px" }}>
                        No planned games available without an existing Working Paper. Create one in the Planner first or select Manual Mode.
                      </div>
                    ) : (
                      <select
                        className="form-control"
                        value={selectedGameId}
                        onChange={handleGameSelect}
                        required
                        style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--border)", backgroundColor: "var(--surface-3)", color: "var(--text)" }}
                      >
                        <option value="">-- Choose a planned game --</option>
                        {plannedGames.map(g => (
                          <option key={g.id} value={g.id}>
                            [{g.scenario.plan.name} - {g.scenario.name}] Game #{g.gameNumber} - {g.name} (${g.denomination})
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                ) : null}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label className="form-label" style={{ fontWeight: 600, display: "block", marginBottom: "6px" }}>
                      Game Number
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      value={manualNumber}
                      onChange={e => setManualNumber(e.target.value)}
                      required
                      placeholder="e.g. 2510"
                      disabled={creationType === "planned" && !selectedGameId}
                      style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--border)", backgroundColor: "var(--surface-3)", color: "var(--text)" }}
                    />
                  </div>
                  <div>
                    <label className="form-label" style={{ fontWeight: 600, display: "block", marginBottom: "6px" }}>
                      Game Name
                    </label>
                    <input
                      type="text"
                      className="form-control"
                      value={manualName}
                      onChange={e => setManualName(e.target.value)}
                      required
                      placeholder="e.g. Golden Scratch 50X"
                      disabled={creationType === "planned" && !selectedGameId}
                      style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--border)", backgroundColor: "var(--surface-3)", color: "var(--text)" }}
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  <div>
                    <label className="form-label" style={{ fontWeight: 600, display: "block", marginBottom: "6px" }}>
                      Denomination ($)
                    </label>
                    <select
                      className="form-control"
                      value={manualDenom}
                      onChange={e => setManualDenom(parseInt(e.target.value, 10))}
                      disabled={creationType === "planned" && !selectedGameId}
                      style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--border)", backgroundColor: "var(--surface-3)", color: "var(--text)" }}
                    >
                      {[1, 2, 3, 5, 10, 20, 25, 30, 50].map(v => (
                        <option key={v} value={v}>${v}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="form-label" style={{ fontWeight: 600, display: "block", marginBottom: "6px" }}>
                      Planned Print Run (Tickets)
                    </label>
                    <input
                      type="number"
                      className="form-control"
                      value={manualPrintRun}
                      onChange={e => setManualPrintRun(parseInt(e.target.value, 10))}
                      required
                      min={1000}
                      disabled={creationType === "planned" && !selectedGameId}
                      style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--border)", backgroundColor: "var(--surface-3)", color: "var(--text)" }}
                    />
                  </div>
                </div>

                <div>
                  <label className="form-label" style={{ fontWeight: 600, display: "block", marginBottom: "6px" }}>
                    Planned Payout Percentage (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    className="form-control"
                    value={manualPayout}
                    onChange={e => setManualPayout(parseFloat(e.target.value))}
                    required
                    min={40}
                    max={95}
                    disabled={creationType === "planned" && !selectedGameId}
                    style={{ width: "100%", padding: "8px", borderRadius: "6px", border: "1px solid var(--border)", backgroundColor: "var(--surface-3)", color: "var(--text)" }}
                  />
                </div>
              </div>

              <div className="card-footer flex justify-end gap-2" style={{ borderTop: "1px solid var(--border)", padding: "12px 20px" }}>
                <button type="button" onClick={() => setShowCreateModal(false)} className="btn btn-secondary">Cancel</button>
                <button
                  type="submit"
                  disabled={isSubmitting || (creationType === "planned" && !selectedGameId)}
                  className="btn btn-primary"
                >
                  {isSubmitting ? "Creating..." : "Initialize Working Paper"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
