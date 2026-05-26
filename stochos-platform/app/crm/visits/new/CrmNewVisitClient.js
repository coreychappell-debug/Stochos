"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function CrmNewVisitClient({ retailers, initialRetailer }) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState("general");
  const [selectedRetailerId, setSelectedRetailerId] = useState(initialRetailer?.id || "");
  const [currentRetailer, setCurrentRetailer] = useState(initialRetailer || null);
  const [loadingAssets, setLoadingAssets] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [offlineSimulate, setOfflineSimulate] = useState(false);
  const [queuedVisits, setQueuedVisits] = useState([]);
  const [syncMessage, setSyncMessage] = useState("");

  // Form State
  const [visitDate, setVisitDate] = useState(new Date().toISOString().split("T")[0]);
  const [checkInTime, setCheckInTime] = useState("");
  const [checkOutTime, setCheckOutTime] = useState("");
  const [notes, setNotes] = useState("");

  // Coaching Form State
  const [askForTheSaleTrained, setAskForTheSaleTrained] = useState(false);
  const [personnelTrainedCount, setPersonnelTrainedCount] = useState(0);
  const [coachingFeedback, setCoachingFeedback] = useState("");
  const [actionPlan, setActionPlan] = useState("");

  // Merchandising Form State
  const [dispensersCleanAndFilled, setDispensersCleanAndFilled] = useState(false);
  const [posSignageVisible, setPosSignageVisible] = useState(false);
  const [ticketInventoryAdequate, setTicketInventoryAdequate] = useState(false);
  const [merchandisingFeedback, setMerchandisingFeedback] = useState("");

  // Process Improvement Form State
  const [salesTrendReviewed, setSalesTrendReviewed] = useState(false);
  const [outOfStockPrevented, setOutOfStockPrevented] = useState(false);
  const [optimalLayoutApplied, setOptimalLayoutApplied] = useState(false);
  const [targetSalesGrowth, setTargetSalesGrowth] = useState("");
  const [improvementFeedback, setImprovementFeedback] = useState("");

  // Asset Verifications State
  const [verifications, setVerifications] = useState([]);

  // Action Items (Tasks) State
  const [openActionItems, setOpenActionItems] = useState(initialRetailer?.actionItems?.filter(a => a.status === "open") || []);
  const [completedActionItemIds, setCompletedActionItemIds] = useState([]);

  // Check checkInTime on load
  useEffect(() => {
    const now = new Date();
    const timeStr = now.toTimeString().split(" ")[0].substring(0, 5); // "HH:MM"
    setCheckInTime(timeStr);
    setCheckOutTime(timeStr);
    
    // Load queued visits from localStorage
    const saved = localStorage.getItem("crm_queued_visits");
    if (saved) {
      try {
        setQueuedVisits(JSON.parse(saved));
      } catch (e) {
        console.error(e);
      }
    }
  }, []);

  // Fetch expected equipment when retailer selection changes
  useEffect(() => {
    if (!selectedRetailerId) {
      setCurrentRetailer(null);
      setVerifications([]);
      return;
    }

    if (initialRetailer && selectedRetailerId === initialRetailer.id) {
      setCurrentRetailer(initialRetailer);
      initVerifications(initialRetailer.assignments);
      return;
    }

    // Otherwise fetch via API
    setLoadingAssets(true);
    fetch(`/api/crm/retailers/${selectedRetailerId}`)
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load retailer equipment");
        return res.json();
      })
      .then((data) => {
        setCurrentRetailer(data);
        initVerifications(data.assignments);
        setOpenActionItems(data.actionItems || []);
        setCompletedActionItemIds([]);
      })
      .catch((err) => {
        alert(err.message);
      })
      .finally(() => {
        setLoadingAssets(false);
      });
  }, [selectedRetailerId]);

  const initVerifications = (assignments) => {
    if (!assignments) return;
    const initialVers = assignments.map((asg) => ({
      assetAssignmentId: asg.id,
      assetName: asg.asset?.type?.name || "Equipment",
      serialNumber: asg.asset?.serialNumber || "N/A",
      category: asg.asset?.type?.category || "Unknown",
      model: asg.asset?.type?.model || "Unknown",
      placementZone: asg.placementZone || "Unknown",
      observedStatus: "present", // Default to present
      isDisputed: false,
      notes: ""
    }));
    setVerifications(initialVers);
  };

  const handleVerificationChange = (index, field, value) => {
    setVerifications((prev) => {
      const copy = [...prev];
      copy[index] = { ...copy[index], [field]: value };
      return copy;
    });
  };

  // Build Submit Data
  const getSubmitPayload = () => {
    const checkInDate = checkInTime ? new Date(`${visitDate}T${checkInTime}:00`) : null;
    const checkOutDate = checkOutTime ? new Date(`${visitDate}T${checkOutTime}:00`) : null;

    return {
      retailerId: selectedRetailerId,
      visitDate: new Date(visitDate).toISOString(),
      checkInTime: checkInDate ? checkInDate.toISOString() : null,
      checkOutTime: checkOutDate ? checkOutDate.toISOString() : null,
      notes,
      coaching: {
        askForTheSaleTrained,
        personnelTrainedCount: parseInt(personnelTrainedCount || "0"),
        coachingFeedback,
        actionPlan
      },
      merchandising: {
        dispensersCleanAndFilled,
        posSignageVisible,
        ticketInventoryAdequate,
        merchandisingFeedback
      },
      process: {
        salesTrendReviewed,
        outOfStockPrevented,
        optimalLayoutApplied,
        targetSalesGrowth: targetSalesGrowth ? parseFloat(targetSalesGrowth) : null,
        improvementFeedback
      },
      verifications: verifications.map((v) => ({
        assetAssignmentId: v.assetAssignmentId,
        observedStatus: v.observedStatus,
        isDisputed: v.isDisputed,
        notes: v.notes
      })),
      completedActionItemIds
    };
  };

  const saveToQueue = (payload) => {
    const retailerName = retailers.find(r => r.id === selectedRetailerId)?.name || "Selected Store";
    const queueItem = {
      id: Math.random().toString(36).substr(2, 9),
      retailerName,
      createdAt: new Date().toISOString(),
      payload
    };
    const updated = [...queuedVisits, queueItem];
    setQueuedVisits(updated);
    localStorage.setItem("crm_queued_visits", JSON.stringify(updated));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedRetailerId) {
      alert("Please select a retailer first.");
      return;
    }

    const payload = getSubmitPayload();

    setIsSubmitting(true);
    try {
      if (offlineSimulate) {
        throw new Error("Simulated Offline Mode: Network request blocked.");
      }

      const res = await fetch("/api/crm/visits", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to submit visit");
      }

      alert("Visit logged successfully!");
      router.push(`/crm/retailers/${selectedRetailerId}`);
      router.refresh();
    } catch (err) {
      console.warn("Sync failed, saving offline:", err.message);
      saveToQueue(payload);
      alert(`Visit queued locally! (Reason: ${err.message}) You can sync it once you have a network connection.`);
      router.push("/crm/retailers");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSyncQueued = async () => {
    if (queuedVisits.length === 0) return;
    setSyncMessage("Syncing visits...");

    const failed = [];
    for (const visit of queuedVisits) {
      try {
        const res = await fetch("/api/crm/visits", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(visit.payload)
        });

        if (!res.ok) {
          const errData = await res.json();
          throw new Error(errData.error || "Server error");
        }
      } catch (e) {
        console.error("Failed to sync item:", visit, e);
        failed.push(visit);
      }
    }

    if (failed.length === 0) {
      setSyncMessage("All queued visits synchronized successfully!");
      localStorage.removeItem("crm_queued_visits");
      setQueuedVisits([]);
      router.refresh();
    } else {
      setSyncMessage(`Synced ${queuedVisits.length - failed.length} visits. ${failed.length} failed. Check network.`);
      setQueuedVisits(failed);
      localStorage.setItem("crm_queued_visits", JSON.stringify(failed));
    }

    setTimeout(() => setSyncMessage(""), 5000);
  };

  const handleRemoveQueued = (id) => {
    if (!confirm("Are you sure you want to discard this unsynced visit?")) return;
    const filtered = queuedVisits.filter(item => item.id !== id);
    setQueuedVisits(filtered);
    localStorage.setItem("crm_queued_visits", JSON.stringify(filtered));
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 1000, margin: "0 auto" }}>
      
      {/* Page Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: "var(--text)" }}>📝 Log Store Visit Audit</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 4 }}>
            Record coaching metrics, verify equipment inventory, and complete displaying reviews.
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button 
            type="button" 
            className={`btn ${offlineSimulate ? "btn-rejected" : "btn-secondary"}`}
            onClick={() => setOfflineSimulate(!offlineSimulate)}
            style={{ fontSize: 12 }}
          >
            🔌 Offline Simulation: {offlineSimulate ? "ON" : "OFF"}
          </button>
          <Link href="/crm/retailers" className="btn btn-secondary">
            Cancel
          </Link>
        </div>
      </div>

      {/* Queued Offline Visits Banner */}
      {queuedVisits.length > 0 && (
        <div className="card" style={{ borderLeft: "4px solid var(--gold)" }}>
          <div className="card-header" style={{ justifyContent: "space-between" }}>
            <h3 style={{ color: "var(--gold)" }}>📍 Unsynced Visits ({queuedVisits.length} Queued)</h3>
            <button className="btn btn-primary btn-sm" onClick={handleSyncQueued}>
              🔄 Sync Queued Now
            </button>
          </div>
          <div className="card-body">
            <p style={{ fontSize: 13, marginBottom: 12 }}>
              These visits were saved locally in your browser because of connection issues or simulated offline mode.
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {queuedVisits.map((q) => (
                <div key={q.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", backgroundColor: "var(--surface-3)", borderRadius: "4px" }}>
                  <div>
                    <strong>{q.retailerName}</strong>
                    <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: 10 }}>
                      Logged on {new Date(q.createdAt).toLocaleString()}
                    </span>
                  </div>
                  <button className="btn btn-secondary btn-sm" style={{ color: "var(--red)" }} onClick={() => handleRemoveQueued(q.id)}>
                    Discard
                  </button>
                </div>
              ))}
            </div>
            {syncMessage && <div style={{ marginTop: 12, fontWeight: "bold", color: "var(--blue)" }}>{syncMessage}</div>}
          </div>
        </div>
      )}

      {/* Main Logging Form */}
      <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        
        {/* Selector Card */}
        <div className="card">
          <div className="card-body" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: 6 }}>
                Retail Location *
              </label>
              <select
                className="select"
                value={selectedRetailerId}
                onChange={(e) => setSelectedRetailerId(e.target.value)}
                required
                style={{ width: "100%", padding: "10px", borderRadius: "6px", backgroundColor: "var(--surface-3)", color: "var(--text)", border: "1px solid var(--border-color)" }}
              >
                <option value="">-- Choose Retailer --</option>
                {retailers.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name} ({r.externalId}) — {r.city}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: 6 }}>
                Visit Date
              </label>
              <input
                type="date"
                className="input"
                value={visitDate}
                onChange={(e) => setVisitDate(e.target.value)}
                required
                style={{ width: "100%", padding: "10px", borderRadius: "6px", backgroundColor: "var(--surface-3)", color: "var(--text)", border: "1px solid var(--border-color)" }}
              />
            </div>
          </div>
        </div>

        {/* Form Tabs Nav */}
        <div style={{ display: "flex", gap: 4, borderBottom: "2px solid var(--surface-3)", paddingBottom: 2 }}>
          {[
            { id: "general", label: "📋 General & Process" },
            { id: "coaching", label: "🎓 Ask for Sale Coaching" },
            { id: "merch", label: "🎨 POS Merchandising" },
            { id: "assets", label: "⚙️ Equipment Audit" }
          ].map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: "10px 16px",
                fontWeight: 600,
                fontSize: 13,
                border: "none",
                borderRadius: "6px 6px 0 0",
                backgroundColor: activeTab === tab.id ? "var(--card-bg)" : "transparent",
                color: activeTab === tab.id ? "var(--blue)" : "var(--text-secondary)",
                borderBottom: activeTab === tab.id ? "2px solid var(--blue)" : "none",
                cursor: "pointer",
                transition: "all 0.2s"
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Tab 1: General & Process */}
        {activeTab === "general" && (
          <div className="card">
            <div className="card-header">
              <h3>General Metrics & Process Improvement</h3>
            </div>
            <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: 6 }}>
                    Check-in Time (24h)
                  </label>
                  <input
                    type="time"
                    className="input"
                    value={checkInTime}
                    onChange={(e) => setCheckInTime(e.target.value)}
                    style={{ width: "100%", padding: "10px", borderRadius: "6px", backgroundColor: "var(--surface-3)", color: "var(--text)", border: "1px solid var(--border-color)" }}
                  />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: 6 }}>
                    Check-out Time (24h)
                  </label>
                  <input
                    type="time"
                    className="input"
                    value={checkOutTime}
                    onChange={(e) => setCheckOutTime(e.target.value)}
                    style={{ width: "100%", padding: "10px", borderRadius: "6px", backgroundColor: "var(--surface-3)", color: "var(--text)", border: "1px solid var(--border-color)" }}
                  />
                </div>
              </div>

              <hr style={{ border: "none", borderTop: "1px solid var(--surface-3)", margin: "10px 0" }} />

              <div>
                <h4 style={{ fontSize: 14, fontWeight: 700, color: "var(--text)", marginBottom: 12 }}>📈 Sales & Process Checklist</h4>
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={salesTrendReviewed}
                      onChange={(e) => setSalesTrendReviewed(e.target.checked)}
                      style={{ width: 18, height: 18 }}
                    />
                    <span>Reviewed store sales trends and dashboard data with manager</span>
                  </label>

                  <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={outOfStockPrevented}
                      onChange={(e) => setOutOfStockPrevented(e.target.checked)}
                      style={{ width: 18, height: 18 }}
                    />
                    <span>Audited inventory and ticket bins to prevent out-of-stock occurrences</span>
                  </label>

                  <label style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
                    <input
                      type="checkbox"
                      checked={optimalLayoutApplied}
                      onChange={(e) => setOptimalLayoutApplied(e.target.checked)}
                      style={{ width: 18, height: 18 }}
                    />
                    <span>Checked planogram/optimal lottery ticket slot layout compliance</span>
                  </label>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr", gap: 20, marginTop: 10 }}>
                <div>
                  <label style={{ display: "block", fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: 6 }}>
                    Target Sales Growth (%)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    placeholder="e.g. 5.5"
                    className="input"
                    value={targetSalesGrowth}
                    onChange={(e) => setTargetSalesGrowth(e.target.value)}
                    style={{ width: "100%", padding: "10px", borderRadius: "6px", backgroundColor: "var(--surface-3)", color: "var(--text)", border: "1px solid var(--border-color)" }}
                  />
                  <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Target performance growth negotiated with retailer for next route cycle.</span>
                </div>
              </div>

              {openActionItems.length > 0 && (
                <div style={{ marginTop: 10, padding: 16, backgroundColor: "var(--surface-4)", borderRadius: 6, border: "1px solid var(--border-color)", display: "flex", flexDirection: "column", gap: 12 }}>
                  <h4 style={{ fontSize: 13, fontWeight: 700, color: "var(--text)", textTransform: "uppercase", letterSpacing: 0.5 }}>
                    🎯 Outstanding Tasks for this Visit
                  </h4>
                  <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                    {openActionItems.map((item) => {
                      const isChecked = completedActionItemIds.includes(item.id);
                      return (
                        <label 
                          key={item.id} 
                          style={{ 
                            display: "flex", 
                            alignItems: "start", 
                            gap: 12, 
                            cursor: "pointer",
                            padding: "10px 12px",
                            backgroundColor: isChecked ? "rgba(40, 167, 69, 0.06)" : "var(--card-bg)",
                            border: isChecked ? "1px solid var(--green)" : "1px solid var(--border-color)",
                            borderRadius: 4,
                            transition: "all 0.2s"
                          }}
                        >
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={(e) => {
                              if (e.target.checked) {
                                setCompletedActionItemIds(prev => [...prev, item.id]);
                              } else {
                                setCompletedActionItemIds(prev => prev.filter(id => id !== item.id));
                              }
                            }}
                            style={{ width: 16, height: 16, marginTop: 2, cursor: "pointer" }}
                          />
                          <div>
                            <strong style={{ fontSize: 13, color: isChecked ? "var(--green)" : "var(--text)" }}>{item.title}</strong>
                            <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>{item.description}</p>
                            {item.dueDate && (
                              <span style={{ fontSize: 10, color: "var(--text-muted)", display: "block", marginTop: 4 }}>
                                Due Date: {new Date(item.dueDate).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                        </label>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: 6 }}>
                  General Process Notes / Action Plan Details
                </label>
                <textarea
                  className="textarea"
                  rows="3"
                  placeholder="Record visit summary details, store personnel observations, etc."
                  value={improvementFeedback}
                  onChange={(e) => setImprovementFeedback(e.target.value)}
                  style={{ width: "100%", padding: "10px", borderRadius: "6px", backgroundColor: "var(--surface-3)", color: "var(--text)", border: "1px solid var(--border-color)", fontFamily: "inherit" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: 6 }}>
                  General Notes
                </label>
                <textarea
                  className="textarea"
                  rows="2"
                  placeholder="General notes (independent of process reviews)"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  style={{ width: "100%", padding: "10px", borderRadius: "6px", backgroundColor: "var(--surface-3)", color: "var(--text)", border: "1px solid var(--border-color)", fontFamily: "inherit" }}
                />
              </div>

            </div>
          </div>
        )}

        {/* Tab 2: Coaching */}
        {activeTab === "coaching" && (
          <div className="card">
            <div className="card-header">
              <h3>🎓 Clerk Salesmanship Coaching</h3>
            </div>
            <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              
              <div style={{ backgroundColor: "var(--surface-3)", padding: "16px", borderRadius: "6px", display: "flex", flexDirection: "column", gap: 12 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer" }}>
                  <input
                    type="checkbox"
                    checked={askForTheSaleTrained}
                    onChange={(e) => setAskForTheSaleTrained(e.target.checked)}
                    style={{ width: 22, height: 22 }}
                  />
                  <div>
                    <strong style={{ display: "block", fontSize: 14 }}>"Ask for the Sale" clerk training conducted?</strong>
                    <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>
                      Check if you coached counter staff on proactive lottery sales techniques.
                    </span>
                  </div>
                </label>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: 6 }}>
                  Number of personnel trained
                </label>
                <input
                  type="number"
                  min="0"
                  className="input"
                  value={personnelTrainedCount}
                  onChange={(e) => setPersonnelTrainedCount(e.target.value)}
                  style={{ width: "100%", padding: "10px", borderRadius: "6px", backgroundColor: "var(--surface-3)", color: "var(--text)", border: "1px solid var(--border-color)" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: 6 }}>
                  Coaching Feedback & Observations
                </label>
                <textarea
                  className="textarea"
                  rows="3"
                  placeholder="Record observations. Did staff understand the script? Was there resistance?"
                  value={coachingFeedback}
                  onChange={(e) => setCoachingFeedback(e.target.value)}
                  style={{ width: "100%", padding: "10px", borderRadius: "6px", backgroundColor: "var(--surface-3)", color: "var(--text)", border: "1px solid var(--border-color)", fontFamily: "inherit" }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: 6 }}>
                  Coaching Follow-Up Action Plan
                </label>
                <textarea
                  className="textarea"
                  rows="2"
                  placeholder="What items should the manager verify before the next route check?"
                  value={actionPlan}
                  onChange={(e) => setActionPlan(e.target.value)}
                  style={{ width: "100%", padding: "10px", borderRadius: "6px", backgroundColor: "var(--surface-3)", color: "var(--text)", border: "1px solid var(--border-color)", fontFamily: "inherit" }}
                />
              </div>

            </div>
          </div>
        )}

        {/* Tab 3: Merchandising */}
        {activeTab === "merch" && (
          <div className="card">
            <div className="card-header">
              <h3>🎨 Point of Sale & Merchandising compliance</h3>
            </div>
            <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 20 }}>
              
              <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", padding: 12, backgroundColor: "var(--surface-3)", borderRadius: 6 }}>
                  <input
                    type="checkbox"
                    checked={dispensersCleanAndFilled}
                    onChange={(e) => setDispensersCleanAndFilled(e.target.checked)}
                    style={{ width: 20, height: 20 }}
                  />
                  <div>
                    <strong style={{ display: "block" }}>Dispensers Clean & Filled?</strong>
                    <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Instant ticket displays are dust-free and have no empty facings.</span>
                  </div>
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", padding: 12, backgroundColor: "var(--surface-3)", borderRadius: 6 }}>
                  <input
                    type="checkbox"
                    checked={posSignageVisible}
                    onChange={(e) => setPosSignageVisible(e.target.checked)}
                    style={{ width: 20, height: 20 }}
                  />
                  <div>
                    <strong style={{ display: "block" }}>POS Signage Visible?</strong>
                    <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Jackpot monitors, promotional flyers, and responsible play decals are visible.</span>
                  </div>
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: 12, cursor: "pointer", padding: 12, backgroundColor: "var(--surface-3)", borderRadius: 6 }}>
                  <input
                    type="checkbox"
                    checked={ticketInventoryAdequate}
                    onChange={(e) => setTicketInventoryAdequate(e.target.checked)}
                    style={{ width: 20, height: 20 }}
                  />
                  <div>
                    <strong style={{ display: "block" }}>Ticket Inventory Adequate?</strong>
                    <span style={{ fontSize: 12, color: "var(--text-secondary)" }}>Backup books are in the vault and active bins have sufficient ticket stock.</span>
                  </div>
                </label>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 12, fontWeight: 700, textTransform: "uppercase", color: "var(--text-secondary)", marginBottom: 6 }}>
                  Merchandising Compliance Feedback
                </label>
                <textarea
                  className="textarea"
                  rows="3"
                  placeholder="Record issues. Note missing posters or dusty play centers here."
                  value={merchandisingFeedback}
                  onChange={(e) => setMerchandisingFeedback(e.target.value)}
                  style={{ width: "100%", padding: "10px", borderRadius: "6px", backgroundColor: "var(--surface-3)", color: "var(--text)", border: "1px solid var(--border-color)", fontFamily: "inherit" }}
                />
              </div>

            </div>
          </div>
        )}

        {/* Tab 4: Asset Check */}
        {activeTab === "assets" && (
          <div className="card">
            <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3>⚙️ Equipment & Asset Presence Check</h3>
              <span className="badge badge-active">{verifications.length} Assets Registered</span>
            </div>
            <div className="card-body">
              <p style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20 }}>
                Audit the physical presence of expected terminals, signs, and fixtures. If an item is <strong>missing</strong>, an active discrepancy exception will be opened.
              </p>

              {loadingAssets ? (
                <div style={{ textAlign: "center", padding: 30 }}>Loading expected equipment checklist...</div>
              ) : verifications.length === 0 ? (
                <div style={{ textAlign: "center", padding: 40, color: "var(--text-muted)", backgroundColor: "var(--surface-3)", borderRadius: 6 }}>
                  {selectedRetailerId 
                    ? "No equipment is assigned to this retailer in the database system."
                    : "Select a retail location above to pull its expected equipment checklist."}
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {verifications.map((ver, idx) => (
                    <div 
                      key={ver.assetAssignmentId} 
                      style={{ 
                        padding: 16, 
                        border: "1px solid var(--border-color)", 
                        borderRadius: 6,
                        backgroundColor: ver.observedStatus === "missing" ? "rgba(220, 53, 69, 0.08)" : "var(--surface-3)",
                        borderLeft: ver.observedStatus === "missing" ? "4px solid var(--red)" : "1px solid var(--border-color)",
                        transition: "all 0.2s"
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 12, alignItems: "start" }}>
                        <div>
                          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                            <span style={{ fontWeight: 700, color: "var(--text)" }}>{ver.assetName}</span>
                            <span style={{ fontSize: 10, textTransform: "uppercase", fontWeight: 700, padding: "2px 6px", borderRadius: 4, backgroundColor: "var(--surface-4)", color: "var(--blue)" }}>
                              {ver.category.replace(/_/g, " ")}
                            </span>
                          </div>
                          <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 4 }}>
                            Model: {ver.model} | S/N: <strong style={{ fontFamily: "monospace" }}>{ver.serialNumber}</strong>
                          </div>
                          <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>
                            Placement: {ver.placementZone.replace(/_/g, " ")}
                          </div>
                        </div>

                        {/* Status Selectors */}
                        <div style={{ display: "flex", flexDirection: "column", gap: 6, alignItems: "flex-end" }}>
                          <div>
                            <label style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", marginRight: 8 }}>Observed:</label>
                            <select
                              value={ver.observedStatus}
                              onChange={(e) => handleVerificationChange(idx, "observedStatus", e.target.value)}
                              style={{ 
                                padding: "4px 8px", 
                                borderRadius: 4, 
                                backgroundColor: "var(--card-bg)", 
                                color: ver.observedStatus === "missing" ? "var(--red)" : "var(--text)",
                                border: "1px solid var(--border-color)",
                                fontWeight: 600
                              }}
                            >
                              <option value="present">🟢 Present</option>
                              <option value="missing">🔴 Missing</option>
                              <option value="incorrect_placement">🟡 Incorrect Zone</option>
                            </select>
                          </div>
                          <label style={{ fontSize: 12, display: "flex", alignItems: "center", gap: 4, cursor: "pointer" }}>
                            <input
                              type="checkbox"
                              checked={ver.isDisputed}
                              onChange={(e) => handleVerificationChange(idx, "isDisputed", e.target.checked)}
                            />
                            <span>Dispute assignment?</span>
                          </label>
                        </div>
                      </div>

                      {/* Verification Notes */}
                      <div style={{ marginTop: 12 }}>
                        <input
                          type="text"
                          placeholder="Audit observation notes (e.g. counter remodel, unplugged peripheral)"
                          value={ver.notes}
                          onChange={(e) => handleVerificationChange(idx, "notes", e.target.value)}
                          style={{ 
                            width: "100%", 
                            padding: "6px 10px", 
                            borderRadius: 4, 
                            backgroundColor: "var(--card-bg)", 
                            color: "var(--text)", 
                            border: "1px solid var(--border-color)",
                            fontSize: 12 
                          }}
                        />
                      </div>

                      {ver.observedStatus === "missing" && (
                        <div style={{ fontSize: 11, color: "var(--red)", marginTop: 8, fontWeight: 600 }}>
                          ⚠️ Warning: This will trigger an automatic 'Missing' discrepancy ticket upon submission.
                        </div>
                      )}

                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Navigation & Submit Buttons */}
        <div className="card">
          <div className="card-body" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div>
              {activeTab !== "general" && (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    const order = ["general", "coaching", "merch", "assets"];
                    const curIdx = order.indexOf(activeTab);
                    setActiveTab(order[curIdx - 1]);
                  }}
                >
                  ◀ Previous
                </button>
              )}
            </div>
            
            <div style={{ display: "flex", gap: 8 }}>
              {activeTab !== "assets" ? (
                <button
                  type="button"
                  className="btn btn-secondary"
                  onClick={() => {
                    const order = ["general", "coaching", "merch", "assets"];
                    const curIdx = order.indexOf(activeTab);
                    setActiveTab(order[curIdx + 1]);
                  }}
                >
                  Next Tab ▶
                </button>
              ) : (
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={isSubmitting || !selectedRetailerId}
                >
                  {isSubmitting ? "Submitting..." : "Submit Visit Audit"}
                </button>
              )}
            </div>
          </div>
        </div>

      </form>
      
    </div>
  );
}
