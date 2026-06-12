"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Map, Store, ShieldAlert, FileSpreadsheet, Navigation, AlertTriangle, Rocket, ClipboardCopy, Users, BookOpen, Split } from "lucide-react";
import HelpDrawer from "../components/HelpDrawer";

function getLocalDateForDay(dayName) {
  const days = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const targetIdx = days.indexOf(dayName);
  if (targetIdx === -1) return new Date().toISOString().split("T")[0];
  
  const today = new Date();
  const currentIdx = today.getDay();
  const diff = targetIdx - currentIdx;
  
  const targetDate = new Date();
  targetDate.setDate(today.getDate() + diff);
  return targetDate.toISOString().split("T")[0]; // YYYY-MM-DD
}

export default function FomoDashboardClient({ stats, recentVisits, openExceptions, routes, currentUser }) {
  const router = useRouter();
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [pendingCheck, setPendingCheck] = useState(null);
  const [submittingVisits, setSubmittingVisits] = useState(false);
  const [assignedRouteCount, setAssignedRouteCount] = useState(0);
  const [assignedDays, setAssignedDays] = useState([]);

  // Check for assigned routes for this user on mount
  useEffect(() => {
    const userId = currentUser?.id;
    if (userId) {
      const saved = localStorage.getItem(`stochos-weekly-schedule-${userId}`);
      if (saved) {
        try {
          const schedule = JSON.parse(saved);
          const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
          let count = 0;
          let activeDays = [];
          
          days.forEach(dayName => {
            const routeData = schedule[dayName];
            if (routeData && !routeData.completed && routeData.selectedIds && routeData.selectedIds.length > 0) {
              count += routeData.selectedIds.length;
              activeDays.push(dayName);
            }
          });
          
          setAssignedRouteCount(count);
          setAssignedDays(activeDays);
        } catch (e) {
          console.error("Failed to parse weekly schedule for alert:", e);
        }
      }
    }
  }, [currentUser]);

  // Check for uncompleted routes in past days on mount
  useEffect(() => {
    const userId = currentUser?.id || "default";
    const saved = localStorage.getItem(`stochos-weekly-schedule-${userId}`);
    if (saved) {
      try {
        const schedule = JSON.parse(saved);
        const days = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday"];
        const todayIndex = new Date().getDay(); // 0 = Sun, 1 = Mon, ..., 5 = Fri
        
        // Iterate through past days of the active week
        for (let i = 1; i < todayIndex && i <= 5; i++) {
          const dayName = days[i - 1];
          const routeData = schedule[dayName];
          
          if (routeData && !routeData.completed && routeData.selectedIds && routeData.selectedIds.length > 0) {
            setPendingCheck({
              day: dayName,
              routeData
            });
            break; // Prompt only one day at a time to prevent modal fatigue
          }
        }
      } catch (e) {
        console.error("Failed to parse weekly schedule:", e);
      }
    }
  }, [currentUser]);

  const handleConfirmVisits = async () => {
    if (!pendingCheck) return;
    setSubmittingVisits(true);
    
    try {
      const { day, routeData } = pendingCheck;
      
      const res = await fetch("/api/fomo/visits/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          retailerIds: routeData.selectedIds,
          visitDate: getLocalDateForDay(day),
          notes: `Batch completed visit logged from weekly route planner for ${day}.`
        })
      });
      
      if (res.ok) {
        // Update local storage to avoid double prompt
        const userId = currentUser?.id || "default";
        const saved = localStorage.getItem(`stochos-weekly-schedule-${userId}`);
        if (saved) {
          const schedule = JSON.parse(saved);
          if (schedule[day]) {
            schedule[day].completed = true;
            localStorage.setItem(`stochos-weekly-schedule-${userId}`, JSON.stringify(schedule));
          }
        }
        router.refresh();
      } else {
        alert("Failed to log visits automatically. Please try again.");
      }
    } catch (e) {
      console.error(e);
      alert("Network error: Could not log completed visits.");
    } finally {
      setSubmittingVisits(false);
      setPendingCheck(null);
    }
  };

  const handleSkipVisits = () => {
    if (pendingCheck) {
      const { day } = pendingCheck;
      const userId = currentUser?.id || "default";
      const saved = localStorage.getItem(`stochos-weekly-schedule-${userId}`);
      if (saved) {
        try {
          const schedule = JSON.parse(saved);
          if (schedule[day]) {
            schedule[day].completed = true;
            localStorage.setItem(`stochos-weekly-schedule-${userId}`, JSON.stringify(schedule));
          }
        } catch (e) {
          console.error(e);
        }
      }
      setPendingCheck(null);
    }
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      
      {/* Assigned Route Alert Banner */}
      {assignedRouteCount > 0 && (
        <div style={{
          padding: "14px 20px",
          backgroundColor: "rgba(255, 193, 7, 0.08)",
          border: "1px solid var(--status-warning-border)",
          borderLeft: "4px solid var(--gold)",
          borderRadius: "8px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <Navigation size={20} style={{ color: "var(--gold)" }} />
            <div>
              <strong style={{ fontSize: 14, color: "var(--gold)", display: "block", marginBottom: 2 }}>Assigned Weekly Field Itinerary Alert</strong>
              <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                You have been assigned route itineraries for <strong style={{ color: "var(--text)" }}>{assignedDays.join(", ")}</strong> with a total of <strong style={{ color: "var(--text)" }}>{assignedRouteCount} stops</strong>.
              </span>
            </div>
          </div>
          <Link href="/fomo/planner" className="btn btn-secondary btn-sm" style={{ backgroundColor: "var(--gold-dim)", borderColor: "var(--gold)", color: "var(--gold)", display: "inline-flex", alignItems: "center", gap: 4, fontWeight: "bold" }}>
            <Navigation size={13} /> View Itinerary Details
          </Link>
        </div>
      )}

      {/* Unassigned Retailer Alert Banner */}
      {stats.unassignedRetailersCount > 0 && (
        <div style={{
          padding: "14px 20px",
          backgroundColor: "rgba(239, 71, 111, 0.08)",
          border: "1px solid var(--status-rejected-border)",
          borderLeft: "4px solid var(--red)",
          borderRadius: "8px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: 12
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <AlertTriangle size={20} style={{ color: "var(--red)" }} />
            <div>
              <strong style={{ fontSize: 14, color: "var(--red)", display: "block", marginBottom: 2 }}>Unassigned Retailer Placement Required</strong>
              <span style={{ fontSize: 13, color: "var(--text-secondary)" }}>
                There are <strong style={{ color: "var(--text)" }}>{stats.unassignedRetailersCount}</strong> new/churned retailers currently without route assignments.
              </span>
            </div>
          </div>
          <Link href="/fomo/territories" className="btn btn-secondary btn-sm" style={{ backgroundColor: "var(--red-dim)", borderColor: "var(--red)", color: "var(--red)", display: "inline-flex", alignItems: "center", gap: 4, fontWeight: "bold" }}>
            <Split size={13} /> Manage Assignments
          </Link>
        </div>
      )}

      {/* Action Buttons Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <Link href="/fomo/map" className="btn btn-primary" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <Map size={16} /> VCRM Partner Map
          </Link>
          <Link href="/fomo/retailers" className="btn btn-secondary" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <Store size={16} /> Retailer Registry
          </Link>
          <Link href="/fomo/mismatches" className="btn btn-secondary" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <ShieldAlert size={16} /> Geodata Audit
          </Link>
          <Link href="/fomo/import" className="btn btn-secondary" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <FileSpreadsheet size={16} /> Importer Console
          </Link>
          <Link href="/fomo/planner" className="btn btn-secondary" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <Navigation size={16} /> Trip Planner
          </Link>
          <Link href="/fomo/territories" className="btn btn-secondary" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <Split size={16} /> Territory Balancer
          </Link>
        </div>

        <button
          onClick={() => setIsHelpOpen(true)}
          className="btn btn-secondary"
          style={{ display: "inline-flex", alignItems: "center", gap: "6px", backgroundColor: "var(--surface-3)", border: "1px solid var(--border)" }}
        >
          <BookOpen size={16} /> Help & Guide
        </button>
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
          <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ display: "flex", alignItems: "center", gap: "8px", margin: 0 }}>
              <AlertTriangle size={18} color="var(--red)" /> Active Equipment Exceptions & Discrepancies
            </h3>
            <span className="badge badge-rejected">{openExceptions.length} Open</span>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {openExceptions.length === 0 ? (
              <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                No active discrepancies found. Expected matches observed state <Rocket size={16} color="var(--green)" />
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
          <div className="card-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h3 style={{ display: "flex", alignItems: "center", gap: "8px", margin: 0 }}>
              <ClipboardCopy size={18} color="var(--blue)" /> Recent Visit Audits
            </h3>
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
          <h3 style={{ display: "flex", alignItems: "center", gap: "8px", margin: 0 }}>
            <Users size={18} color="var(--blue)" /> Live Operations Representative & Territory Health Report
          </h3>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Route Code</th>
                <th>Route / Territory Name</th>
                <th>Assigned Representative</th>
                <th style={{ textAlign: "center" }}>Total Accounts</th>
                <th style={{ textAlign: "center" }}>Visit Freshness (30-day)</th>
                <th style={{ textAlign: "center" }}>Coaching Coverage</th>
                <th style={{ textAlign: "center" }}>Active Exceptions</th>
                <th style={{ textAlign: "center" }}>Unvisited Accounts</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {routes.map((rt) => {
                const totalStores = rt.retailers?.length || 0;
                
                // 1. Visit Freshness (visited within the last 30 days)
                const visitedLast30 = rt.retailers?.filter(ret => {
                  if (!ret.lastVisitDate) return false;
                  const diffTime = Math.abs(new Date() - new Date(ret.lastVisitDate));
                  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                  return diffDays <= 30;
                }).length || 0;
                
                const freshnessScore = totalStores > 0 
                  ? Math.round((visitedLast30 / totalStores) * 100) 
                  : 0;

                // 2. Training Coverage
                const trainedCount = rt.retailers?.filter(ret => ret.trainingStatus === "trained").length || 0;
                const trainingScore = totalStores > 0 
                  ? Math.round((trainedCount / totalStores) * 100) 
                  : 0;

                // 3. Open Exceptions
                const exceptionsCount = rt.retailers?.reduce((acc, ret) => acc + (ret.discrepancies?.length || 0), 0) || 0;

                // 4. Cold Accounts (never visited)
                const neverVisitedCount = rt.retailers?.filter(ret => !ret.lastVisitDate).length || 0;

                // Color coding for freshness
                let freshnessColor = "var(--green)";
                let freshnessBg = "rgba(40, 167, 69, 0.08)";
                if (freshnessScore < 40) {
                  freshnessColor = "var(--red)";
                  freshnessBg = "rgba(220, 53, 69, 0.08)";
                } else if (freshnessScore < 75) {
                  freshnessColor = "var(--gold)";
                  freshnessBg = "rgba(255, 193, 7, 0.08)";
                }

                // Color coding for training
                let trainingColor = "var(--green)";
                let trainingBg = "rgba(40, 167, 69, 0.08)";
                if (trainingScore < 50) {
                  trainingColor = "var(--red)";
                  trainingBg = "rgba(220, 53, 69, 0.08)";
                } else if (trainingScore < 80) {
                  trainingColor = "var(--blue)";
                  trainingBg = "rgba(0, 180, 216, 0.08)";
                }

                return (
                  <tr key={rt.id}>
                    <td style={{ fontWeight: 600, color: "var(--blue)" }}>{rt.code}</td>
                    <td>{rt.name}</td>
                    <td>
                      {rt.rep ? (
                        <div>
                          <strong>{rt.rep.name}</strong>
                          <div style={{ fontSize: 10.5, color: "var(--text-muted)" }}>{rt.rep.email.split("@")[0]}</div>
                        </div>
                      ) : (
                        <span style={{ fontStyle: "italic", color: "var(--text-muted)" }}>Unassigned</span>
                      )}
                    </td>
                    <td style={{ textAlign: "center", fontWeight: 600 }}>{totalStores} stores</td>
                    <td style={{ textAlign: "center" }}>
                      <span style={{
                        display: "inline-block",
                        padding: "3px 8px",
                        borderRadius: "4px",
                        fontSize: "11px",
                        fontWeight: "bold",
                        color: freshnessColor,
                        backgroundColor: freshnessBg,
                        border: `1px solid ${freshnessColor}`
                      }}>
                        {freshnessScore}%
                      </span>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      <span style={{
                        display: "inline-block",
                        padding: "3px 8px",
                        borderRadius: "4px",
                        fontSize: "11px",
                        fontWeight: "bold",
                        color: trainingColor,
                        backgroundColor: trainingBg,
                        border: `1px solid ${trainingColor}`
                      }}>
                        {trainingScore}%
                      </span>
                    </td>
                    <td style={{ textAlign: "center" }}>
                      {exceptionsCount > 0 ? (
                        <span className="badge badge-rejected" style={{ fontWeight: "bold" }}>
                          {exceptionsCount} Issues
                        </span>
                      ) : (
                        <span className="badge badge-active" style={{ opacity: 0.8 }}>0</span>
                      )}
                    </td>
                    <td style={{ textAlign: "center" }}>
                      {neverVisitedCount > 0 ? (
                        <span className="badge badge-submitted" style={{ fontWeight: "bold", color: "var(--gold)", borderColor: "var(--gold)", backgroundColor: "rgba(255, 193, 7, 0.05)" }}>
                          {neverVisitedCount} Cold
                        </span>
                      ) : (
                        <span className="badge badge-active" style={{ opacity: 0.8 }}>0</span>
                      )}
                    </td>
                    <td>
                      {rt.rep ? (
                        <Link 
                          href={`/fomo/planner?repId=${rt.rep.id}`}
                          className="btn btn-secondary btn-sm"
                          style={{ padding: "4px 8px", fontSize: 11, display: "inline-flex", alignItems: "center", gap: 4, fontWeight: "bold", color: "var(--blue)", borderColor: "var(--blue)" }}
                        >
                          Map Route
                        </Link>
                      ) : (
                        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <HelpDrawer topicId="fomo" isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />

      {pendingCheck && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          width: "100vw",
          height: "100vh",
          backgroundColor: "rgba(10, 22, 40, 0.75)",
          backdropFilter: "blur(6px)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 10000,
          color: "var(--text)"
        }}>
          <div className="card" style={{ maxWidth: 440, width: "90%", padding: 24, boxShadow: "var(--shadow-elevated)", border: "1px solid var(--border)", backgroundColor: "var(--card-bg)" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 16 }}>
              <div style={{ padding: 10, borderRadius: "50%", backgroundColor: "var(--blue-dim)", color: "var(--blue)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <Navigation size={24} />
              </div>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800 }}>Post-Visit Completion</h3>
            </div>
            
            <p style={{ fontSize: 13.5, lineHeight: 1.5, color: "var(--text-secondary)", margin: "0 0 16px 0" }}>
              Welcome back! The system detected you had a planned itinerary of <strong>{pendingCheck.routeData.selectedIds.length} stops</strong> for <strong>{pendingCheck.day}</strong> ({getLocalDateForDay(pendingCheck.day)}) starting from <em>{pendingCheck.routeData.startPoint.name}</em>.
            </p>
            
            <div style={{ fontSize: 12.5, backgroundColor: "var(--surface-1)", padding: "10px 14px", borderRadius: 6, border: "1px solid var(--border)", marginBottom: 20 }}>
              <div style={{ fontWeight: 700, color: "var(--text)", marginBottom: 4 }}>Automated visit logs will record:</div>
              <ul style={{ paddingLeft: 16, margin: 0, color: "var(--text-secondary)", display: "flex", flexDirection: "column", gap: 4 }}>
                <li>Status: <strong>Completed</strong></li>
                <li>Visit Date: <strong>{getLocalDateForDay(pendingCheck.day)}</strong></li>
                <li>Updated "Last Visit Date" for {pendingCheck.routeData.selectedIds.length} retailers</li>
              </ul>
            </div>
            
            <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={handleSkipVisits}
                disabled={submittingVisits}
                style={{ fontSize: 12 }}
              >
                No, Skip
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleConfirmVisits}
                disabled={submittingVisits}
                style={{ fontSize: 12, backgroundColor: "var(--green)", borderColor: "var(--green)", color: "#fff" }}
              >
                {submittingVisits ? "Logging..." : "Yes, Log All Visits"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
