'use client';

import { useState, useEffect } from "react";
import Sidebar from "../components/Sidebar";
import { useSession } from "next-auth/react";

export default function BudgetingPage() {
  const { data: session } = useSession();
  const [proposals, setProposals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fiscalYear, setFiscalYear] = useState(2027);

  // Modal / Detail state for Finance review
  const [selectedProposal, setSelectedProposal] = useState(null);
  const [reviewNotes, setReviewNotes] = useState("");

  // Get user details
  const user = session?.user;
  const isFinanceOrExec = user?.division === "FINANCE" || user?.division === "EXECUTIVE" || user?.role === "admin";

  useEffect(() => {
    async function loadProposals() {
      try {
        setLoading(true);
        setError("");
        const res = await fetch(`/api/budget-proposals?fiscalYear=${fiscalYear}`);
        if (res.ok) {
          const data = await res.json();
          setProposals(data);
        } else {
          setError("Failed to load budget proposals.");
        }
      } catch (err) {
        console.error(err);
        setError("Error loading proposals from server.");
      } finally {
        setLoading(false);
      }
    }

    if (session) {
      loadProposals();
    }
  }, [session, fiscalYear]);

  // Handle line item change for Division Lead editor
  const handleItemChange = (index, field, value) => {
    const updated = [...proposals];
    if (updated[0]) {
      const items = [...updated[0].proposalData];
      items[index][field] = field === "amount" ? parseFloat(value || 0) : value;
      updated[0].proposalData = items;
      setProposals(updated);
    }
  };

  // Add Item to proposalData
  const handleAddItem = () => {
    const updated = [...proposals];
    if (updated[0]) {
      const items = [...updated[0].proposalData, { category: "Operations", desc: "New line item", amount: 1000.00 }];
      updated[0].proposalData = items;
      setProposals(updated);
    }
  };

  // Remove Item
  const handleRemoveItem = (index) => {
    const updated = [...proposals];
    if (updated[0]) {
      const items = updated[0].proposalData.filter((_, i) => i !== index);
      updated[0].proposalData = items;
      setProposals(updated);
    }
  };

  // Save Draft (POST)
  const handleSaveDraft = async () => {
    const prop = proposals[0];
    if (!prop) return;
    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const res = await fetch("/api/budget-proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          division: prop.division,
          fiscalYear: prop.fiscalYear,
          proposalData: prop.proposalData,
          notes: prop.notes || ""
        })
      });

      if (res.ok) {
        setSuccess("Budget proposal saved as draft successfully.");
        const data = await res.json();
        setProposals([data]);
      } else {
        const errData = await res.json();
        setError(errData.error || "Failed to save proposal.");
      }
    } catch (err) {
      console.error(err);
      setError("Network error: failed to save.");
    } finally {
      setSaving(false);
    }
  };

  // Submit Proposal (PUT)
  const handleSubmitProposal = async () => {
    const prop = proposals[0];
    if (!prop) return;
    try {
      setSaving(true);
      setError("");
      setSuccess("");

      // First save the current data
      await fetch("/api/budget-proposals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          division: prop.division,
          fiscalYear: prop.fiscalYear,
          proposalData: prop.proposalData,
          notes: prop.notes || ""
        })
      });

      // Then trigger submit transition
      const res = await fetch("/api/budget-proposals", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: prop.id,
          action: "submit"
        })
      });

      if (res.ok) {
        setSuccess("Budget proposal submitted to Finance for review 📄");
        const data = await res.json();
        setProposals([data]);
      } else {
        const errData = await res.json();
        setError(errData.error || "Failed to submit proposal.");
      }
    } catch (err) {
      console.error(err);
      setError("Network error: failed to submit.");
    } finally {
      setSaving(false);
    }
  };

  // Finance Actions: Approve / Reject (PUT)
  const handleReviewAction = async (action) => {
    if (!selectedProposal) return;
    try {
      setSaving(true);
      setError("");
      setSuccess("");

      const res = await fetch("/api/budget-proposals", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: selectedProposal.id,
          action,
          reviewNotes
        })
      });

      if (res.ok) {
        setSuccess(`Budget proposal for ${selectedProposal.division} ${action === "approve" ? "Approved" : "Rejected"} successfully.`);
        const data = await res.json();
        // Update local state list
        setProposals(proposals.map(p => p.id === data.id ? data : p));
        setSelectedProposal(null);
        setReviewNotes("");
      } else {
        const errData = await res.json();
        setError(errData.error || `Failed to ${action} proposal.`);
      }
    } catch (err) {
      console.error(err);
      setError("Network error: review action failed.");
    } finally {
      setSaving(false);
    }
  };

  // Compile Master Budget Rollup (POST /api/reporting/sync-budget)
  const handleCompileBudget = async () => {
    try {
      setSyncing(true);
      setError("");
      setSuccess("");

      const res = await fetch(`/api/reporting/sync-budget?fiscalYear=${fiscalYear}`, {
        method: "POST"
      });

      if (res.ok) {
        const data = await res.json();
        setSuccess("Unified Budget Compiled! Rolled up approved scratcher planning, draw planning, and division proposals to GFPA ⚡");
        console.log("Compiled data scenario:", data);
      } else {
        const errData = await res.json();
        setError(errData.error || "Failed to compile master budget.");
      }
    } catch (err) {
      console.error(err);
      setError("Network error: failed to compile.");
    } finally {
      setSyncing(false);
    }
  };

  // Summary figures helper
  const getProposalTotal = (prop) => {
    const items = Array.isArray(prop?.proposalData) ? prop.proposalData : [];
    return items.reduce((acc, curr) => acc + (parseFloat(curr.amount) || 0), 0);
  };

  const getStatusBadgeColor = (status) => {
    switch (status) {
      case "approved": return "var(--green)";
      case "submitted": return "var(--blue)";
      case "rejected": return "#ef4444";
      default: return "#6b7280"; // draft
    }
  };

  return (
    <div className="app-layout">
      <Sidebar />
      <main className="main-content">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
          <div>
            <h1 style={{ fontSize: "28px", fontWeight: "800", color: "var(--text)", margin: 0, letterSpacing: "-0.5px" }}>
              Divisional Budgeting Cockpit
            </h1>
            <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginTop: "4px", margin: 0 }}>
              {isFinanceOrExec 
                ? "Review and approve divisional proposals, then compile the master budget package." 
                : "Submit your division's operational and G&A budget proposal for the fiscal year."}
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

            {isFinanceOrExec && (
              <button 
                onClick={handleCompileBudget} 
                disabled={syncing || loading}
                className="btn btn-primary"
                style={{ backgroundColor: "var(--gold)", border: "none" }}
              >
                {syncing ? "Compiling..." : "Compile & Roll Up Budget ⚡"}
              </button>
            )}
          </div>
        </div>

        {error && (
          <div style={{ padding: "12px", backgroundColor: "#fef2f2", color: "#b91c1c", borderRadius: "6px", border: "1px solid #fee2e2", marginBottom: "1.5rem", fontSize: 14 }}>
            ⚠️ {error}
          </div>
        )}

        {success && (
          <div style={{ padding: "12px", backgroundColor: "#f0fdf4", color: "#166534", borderRadius: "6px", border: "1px solid #dcfce7", marginBottom: "1.5rem", fontSize: 14 }}>
            ✓ {success}
          </div>
        )}

        {loading ? (
          <div style={{ padding: "3rem", textAlign: "center", color: "var(--text-secondary)" }}>
            Loading budget workspaces...
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
            
            {/* VIEW A: FINANCE/EXECUTIVE COCKPIT */}
            {isFinanceOrExec && (
              <div className="card" style={{ background: "var(--card-bg)" }}>
                <div className="card-header">
                  <h3 style={{ margin: 0 }}>Division Submissions</h3>
                </div>
                <div className="card-body" style={{ padding: 0, overflowX: "auto" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", color: "var(--text)", fontSize: 13 }}>
                    <thead>
                      <tr style={{ backgroundColor: "var(--surface-3)", borderBottom: "1px solid var(--border)" }}>
                        <th style={{ textAlign: "left", padding: "12px 16px" }}>Division</th>
                        <th style={{ textAlign: "left", padding: "12px 16px" }}>Prepared By</th>
                        <th style={{ textAlign: "left", padding: "12px 16px" }}>Status</th>
                        <th style={{ textAlign: "right", padding: "12px 16px" }}>Requested Total ($)</th>
                        <th style={{ textAlign: "left", padding: "12px 16px" }}>Notes / Variance Justification</th>
                        <th style={{ textAlign: "center", padding: "12px 16px", width: 120 }}>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {proposals.length === 0 ? (
                        <tr>
                          <td colSpan={6} style={{ textAlign: "center", padding: "32px", color: "var(--text-secondary)" }}>
                            No division proposals created for FY{fiscalYear}.
                          </td>
                        </tr>
                      ) : (
                        proposals.map(p => (
                          <tr key={p.id} style={{ borderBottom: "1px solid var(--border)", verticalAlign: "middle" }}>
                            <td style={{ padding: "12px 16px", fontWeight: "bold" }}>{p.division}</td>
                            <td style={{ padding: "12px 16px" }}>{p.submittedBy?.name || "System"} ({p.submittedBy?.email || "-"})</td>
                            <td style={{ padding: "12px 16px" }}>
                              <span style={{ padding: "3px 8px", borderRadius: "12px", color: "#fff", fontSize: 11, backgroundColor: getStatusBadgeColor(p.status) }}>
                                {p.status.toUpperCase()}
                              </span>
                            </td>
                            <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: 600, fontFamily: "var(--font-mono)" }}>
                              ${getProposalTotal(p).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </td>
                            <td style={{ padding: "12px 16px", maxWidth: 300, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {p.notes || <span style={{ color: "var(--text-secondary)", fontStyle: "italic" }}>No justification provided</span>}
                            </td>
                            <td style={{ padding: "12px 16px", textAlign: "center" }}>
                              <button 
                                onClick={() => setSelectedProposal(p)}
                                className="btn"
                                style={{ padding: "6px 12px", fontSize: 12, backgroundColor: "var(--surface-3)", border: "1px solid var(--border)", color: "var(--text)" }}
                              >
                                Review Ledger
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* VIEW B: INDIVIDUAL DIVISION LEDGER WRITER */}
            {!isFinanceOrExec && proposals[0] && (
              <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
                <div className="kpi-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
                  <div className="kpi-card kpi-blue">
                    <div className="kpi-label">Your Division</div>
                    <div className="kpi-value">{proposals[0].division}</div>
                    <div className="kpi-subtitle">Operational ledger</div>
                  </div>
                  <div className="kpi-card kpi-gold">
                    <div className="kpi-label">Proposal Total</div>
                    <div className="kpi-value">${getProposalTotal(proposals[0]).toLocaleString(undefined, { minimumFractionDigits: 2 })}</div>
                    <div className="kpi-subtitle">Sum of requested lines</div>
                  </div>
                  <div className="kpi-card kpi-purple">
                    <div className="kpi-label">Submission Status</div>
                    <div className="kpi-value" style={{ textTransform: "capitalize" }}>{proposals[0].status}</div>
                    <div className="kpi-subtitle">Workflow state</div>
                  </div>
                </div>

                <div className="card" style={{ background: "var(--card-bg)" }}>
                  <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h3 style={{ margin: 0 }}>Proposed Ledger Items</h3>
                    {proposals[0].status === "draft" && (
                      <button 
                        onClick={handleAddItem}
                        className="btn"
                        style={{ fontSize: 13, display: "flex", alignItems: "center", gap: 6, backgroundColor: "var(--surface-3)", border: "1px solid var(--border)", color: "var(--text)" }}
                      >
                        <span>+</span> Add Line Item
                      </button>
                    )}
                  </div>
                  <div className="card-body" style={{ padding: 0, overflowX: "auto" }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", color: "var(--text)", fontSize: 13 }}>
                      <thead>
                        <tr style={{ backgroundColor: "var(--surface-3)", borderBottom: "1px solid var(--border)" }}>
                          <th style={{ textAlign: "left", padding: "12px 16px", width: 180 }}>Category</th>
                          <th style={{ textAlign: "left", padding: "12px 16px" }}>Detailed Description</th>
                          <th style={{ textAlign: "right", padding: "12px 16px", width: 160 }}>Request Amount ($)</th>
                          {proposals[0].status === "draft" && <th style={{ textAlign: "center", padding: "12px 16px", width: 60 }}>Actions</th>}
                        </tr>
                      </thead>
                      <tbody>
                        {proposals[0].proposalData.length === 0 ? (
                          <tr>
                            <td colSpan={proposals[0].status === "draft" ? 4 : 3} style={{ textAlign: "center", padding: "32px", color: "var(--text-secondary)" }}>
                              No items drafted. Click &quot;Add Line Item&quot; to begin.
                            </td>
                          </tr>
                        ) : (
                          proposals[0].proposalData.map((item, index) => (
                            <tr key={index} style={{ borderBottom: "1px solid var(--border)", verticalAlign: "middle" }}>
                              <td style={{ padding: "10px 16px" }}>
                                <input 
                                  type="text"
                                  value={item.category}
                                  onChange={(e) => handleItemChange(index, "category", e.target.value)}
                                  disabled={proposals[0].status !== "draft"}
                                  style={{ width: "100%", padding: "6px", borderRadius: "4px", backgroundColor: proposals[0].status === "draft" ? "var(--surface-3)" : "transparent", border: proposals[0].status === "draft" ? "1px solid var(--border)" : "none", color: "var(--text)", fontSize: 13 }}
                                />
                              </td>
                              <td style={{ padding: "10px 16px" }}>
                                <input 
                                  type="text"
                                  value={item.desc}
                                  onChange={(e) => handleItemChange(index, "desc", e.target.value)}
                                  disabled={proposals[0].status !== "draft"}
                                  style={{ width: "100%", padding: "6px", borderRadius: "4px", backgroundColor: proposals[0].status === "draft" ? "var(--surface-3)" : "transparent", border: proposals[0].status === "draft" ? "1px solid var(--border)" : "none", color: "var(--text)", fontSize: 13 }}
                                />
                              </td>
                              <td style={{ padding: "10px 16px", textAlign: "right" }}>
                                <input 
                                  type="number"
                                  value={item.amount}
                                  onChange={(e) => handleItemChange(index, "amount", e.target.value)}
                                  disabled={proposals[0].status !== "draft"}
                                  style={{ width: 120, padding: "6px", textAlign: "right", borderRadius: "4px", backgroundColor: proposals[0].status === "draft" ? "var(--surface-3)" : "transparent", border: proposals[0].status === "draft" ? "1px solid var(--border)" : "none", color: "var(--text)", fontSize: 13, fontFamily: "var(--font-mono)" }}
                                />
                              </td>
                              {proposals[0].status === "draft" && (
                                <td style={{ padding: "10px 16px", textAlign: "center" }}>
                                  <button 
                                    onClick={() => handleRemoveItem(index)}
                                    style={{ color: "#ef4444", background: "none", border: "none", cursor: "pointer", fontSize: 16 }}
                                  >
                                    🗑️
                                  </button>
                                </td>
                              )}
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="card" style={{ background: "var(--card-bg)", padding: "20px" }}>
                  <h4 style={{ margin: "0 0 12px 0" }}>Justification & Narrative Comments</h4>
                  <textarea 
                    rows={4}
                    value={proposals[0].notes || ""}
                    onChange={(e) => {
                      const updated = [...proposals];
                      updated[0].notes = e.target.value;
                      setProposals(updated);
                    }}
                    disabled={proposals[0].status !== "draft"}
                    placeholder="Enter any notes, explanation of variance from prior fiscal years, or business case descriptions..."
                    style={{ width: "100%", padding: "10px", borderRadius: "6px", backgroundColor: proposals[0].status === "draft" ? "var(--surface-3)" : "var(--surface-2)", border: "1px solid var(--border)", color: "var(--text)", fontSize: 13, resize: "none" }}
                  />
                  
                  {proposals[0].status === "draft" && (
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 12, marginTop: "16px" }}>
                      <button 
                        onClick={handleSaveDraft}
                        disabled={saving}
                        className="btn"
                        style={{ backgroundColor: "var(--surface-3)", border: "1px solid var(--border)", color: "var(--text)", minWidth: 100 }}
                      >
                        Save Draft 💾
                      </button>
                      <button 
                        onClick={handleSubmitProposal}
                        disabled={saving}
                        className="btn btn-primary"
                        style={{ minWidth: 150 }}
                      >
                        Submit Proposal 📄
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* DETAIL REVIEW MODAL FOR FINANCE REVIEW */}
            {selectedProposal && (
              <div style={{ position: "fixed", top: 0, left: 0, width: "100%", height: "100%", backgroundColor: "rgba(0,0,0,0.5)", zIndex: 100, display: "flex", justifyContent: "center", alignItems: "center" }}>
                <div style={{ width: "80%", maxWidth: "800px", maxHeight: "90%", backgroundColor: "var(--card-bg)", border: "1px solid var(--border)", borderRadius: "8px", padding: "24px", overflowY: "auto", display: "flex", flexDirection: "column", gap: 20 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border)", paddingBottom: "12px" }}>
                    <h3 style={{ margin: 0 }}>Reviewing Proposal: {selectedProposal.division} Division</h3>
                    <button 
                      onClick={() => setSelectedProposal(null)}
                      style={{ border: "none", background: "none", color: "var(--text)", fontSize: 16, cursor: "pointer" }}
                    >
                      ❌
                    </button>
                  </div>

                  {/* Ledger display */}
                  <table style={{ width: "100%", borderCollapse: "collapse", color: "var(--text)", fontSize: 13 }}>
                    <thead>
                      <tr style={{ backgroundColor: "var(--surface-3)", borderBottom: "1px solid var(--border)" }}>
                        <th style={{ textAlign: "left", padding: "10px" }}>Category</th>
                        <th style={{ textAlign: "left", padding: "10px" }}>Description</th>
                        <th style={{ textAlign: "right", padding: "10px", width: 140 }}>Amount ($)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedProposal.proposalData.map((item, idx) => (
                        <tr key={idx} style={{ borderBottom: "1px solid var(--border)" }}>
                          <td style={{ padding: "10px", fontWeight: "bold" }}>{item.category}</td>
                          <td style={{ padding: "10px" }}>{item.desc}</td>
                          <td style={{ padding: "10px", textAlign: "right", fontFamily: "var(--font-mono)" }}>
                            ${parseFloat(item.amount).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      ))}
                      <tr style={{ backgroundColor: "var(--surface-3)", fontWeight: "bold" }}>
                        <td colSpan={2} style={{ padding: "10px", textAlign: "right" }}>Proposal Total:</td>
                        <td style={{ padding: "10px", textAlign: "right", fontFamily: "var(--font-mono)" }}>
                          ${getProposalTotal(selectedProposal).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  {selectedProposal.notes && (
                    <div style={{ backgroundColor: "var(--surface-3)", padding: "12px", borderRadius: "6px", border: "1px solid var(--border)" }}>
                      <strong style={{ display: "block", fontSize: 12, marginBottom: "4px", color: "var(--text-secondary)" }}>Division Manager Justification:</strong>
                      <span style={{ fontSize: 13 }}>{selectedProposal.notes}</span>
                    </div>
                  )}

                  {selectedProposal.status === "submitted" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                      <strong style={{ fontSize: 13 }}>Review Decisions & Action Comments:</strong>
                      <textarea 
                        rows={3}
                        value={reviewNotes}
                        onChange={(e) => setReviewNotes(e.target.value)}
                        placeholder="Enter justification for approval or list required corrections if rejecting..."
                        style={{ width: "100%", padding: "10px", borderRadius: "6px", backgroundColor: "var(--surface-3)", border: "1px solid var(--border)", color: "var(--text)", fontSize: 13, resize: "none" }}
                      />

                      <div style={{ display: "flex", justifyContent: "flex-end", gap: 12 }}>
                        <button 
                          onClick={() => handleReviewAction("reject")}
                          disabled={saving}
                          className="btn"
                          style={{ backgroundColor: "#ef4444", color: "#fff", border: "none", minWidth: 100 }}
                        >
                          Reject Proposal ❌
                        </button>
                        <button 
                          onClick={() => handleReviewAction("approve")}
                          disabled={saving}
                          className="btn"
                          style={{ backgroundColor: "var(--green)", color: "#fff", border: "none", minWidth: 100 }}
                        >
                          Approve Proposal ✓
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>
        )}
      </main>
    </div>
  );
}
