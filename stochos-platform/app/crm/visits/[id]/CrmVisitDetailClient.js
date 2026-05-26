"use client";

import Link from "next/link";

export default function CrmVisitDetailClient({ visit }) {
  const isMerchCompliant = visit.merchandising?.dispensersCleanAndFilled && 
                           visit.merchandising?.posSignageVisible && 
                           visit.merchandising?.ticketInventoryAdequate;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, maxWidth: 1000, margin: "0 auto" }}>
      
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Store Visit Report
          </span>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: "var(--text)", marginTop: 4 }}>
            Audit Summary: {visit.retailer?.name}
          </h2>
          <p style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 4 }}>
            Conducted by <strong>{visit.user?.name}</strong> on {new Date(visit.visitDate).toLocaleDateString()}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href={`/crm/retailers/${visit.retailerId}`} className="btn btn-secondary">
            ⬅ Back to Retailer Profile
          </Link>
          <Link href="/crm" className="btn btn-secondary">
            🏠 CRM Dashboard
          </Link>
        </div>
      </div>

      {/* Grid: Left Column (General info + Stats), Right Column (Tab Details) */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 24, alignItems: "start" }}>
        
        {/* Visit Metadata Panel */}
        <div className="card">
          <div className="card-header">
            <h3>Visit Metadata</h3>
            <span className="badge badge-active">synced</span>
          </div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase" }}>Retailer ID</div>
              <div style={{ fontWeight: 600 }}>{visit.retailer?.externalId}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase" }}>City / Route</div>
              <div>{visit.retailer?.city} | <span style={{ color: "var(--blue)", fontWeight: 500 }}>{visit.retailer?.route?.code}</span></div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase" }}>Time in Store</div>
              <div style={{ fontWeight: 500 }}>
                {visit.checkInTime ? new Date(visit.checkInTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—"} to{" "}
                {visit.checkOutTime ? new Date(visit.checkOutTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : "—"}
              </div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase" }}>Coaching Result</div>
              <span className={`badge badge-${visit.coaching?.askForTheSaleTrained ? "approved" : "draft"}`}>
                {visit.coaching?.askForTheSaleTrained ? '"Ask for Sale" Trained' : "No Coaching"}
              </span>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase" }}>Merchandising Status</div>
              <span className={`badge badge-${isMerchCompliant ? "approved" : "rejected"}`}>
                {isMerchCompliant ? "Fully Compliant" : "Audit Discrepancy"}
              </span>
            </div>
            {visit.notes && (
              <div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase" }}>Visit Notes</div>
                <div style={{ fontSize: 13, color: "var(--text-secondary)", whiteSpace: "pre-wrap" }}>{visit.notes}</div>
              </div>
            )}
          </div>
        </div>

        {/* Detailed Logs Panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          
          {/* Process Improvement Card */}
          <div className="card">
            <div className="card-header">
              <h3>📈 Process & Sales Improvement Review</h3>
            </div>
            <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16 }}>
                <div style={{ padding: 12, backgroundColor: "var(--surface-3)", borderRadius: 6 }}>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>Reviewed sales trends</div>
                  <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4 }}>
                    {visit.process?.salesTrendReviewed ? "✅ Yes" : "❌ No"}
                  </div>
                </div>
                <div style={{ padding: 12, backgroundColor: "var(--surface-3)", borderRadius: 6 }}>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>OOS prevented</div>
                  <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4 }}>
                    {visit.process?.outOfStockPrevented ? "✅ Yes" : "❌ No"}
                  </div>
                </div>
                <div style={{ padding: 12, backgroundColor: "var(--surface-3)", borderRadius: 6 }}>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>Optimal layout applied</div>
                  <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4 }}>
                    {visit.process?.optimalLayoutApplied ? "✅ Yes" : "❌ No"}
                  </div>
                </div>
                <div style={{ padding: 12, backgroundColor: "var(--surface-3)", borderRadius: 6 }}>
                  <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>Target Sales Growth</div>
                  <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4, color: "var(--blue)" }}>
                    {visit.process?.targetSalesGrowth ? `+${visit.process.targetSalesGrowth}%` : "Not set"}
                  </div>
                </div>
              </div>
              
              {visit.process?.improvementFeedback && (
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase" }}>Process Observations & Notes</div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4, whiteSpace: "pre-wrap" }}>
                    {visit.process.improvementFeedback}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Coaching Details Card */}
          <div className="card">
            <div className="card-header">
              <h3>🎓 "Ask for the Sale" Coaching Log</h3>
            </div>
            <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1.5fr", gap: 16 }}>
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase" }}>Clerk Training Conducted</div>
                  <div style={{ fontSize: 15, fontWeight: 700, marginTop: 4, color: visit.coaching?.askForTheSaleTrained ? "var(--green)" : "var(--text-secondary)" }}>
                    {visit.coaching?.askForTheSaleTrained ? "Completed" : "Not Performed"}
                  </div>
                </div>
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase" }}>Personnel Coached</div>
                  <div style={{ fontSize: 15, fontWeight: 700, marginTop: 4 }}>
                    {visit.coaching?.personnelTrainedCount || 0} counter clerks
                  </div>
                </div>
              </div>

              {visit.coaching?.coachingFeedback && (
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase" }}>Coaching Notes & Observations</div>
                  <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4, whiteSpace: "pre-wrap" }}>
                    {visit.coaching.coachingFeedback}
                  </p>
                </div>
              )}

              {visit.coaching?.actionPlan && (
                <div style={{ padding: "12px", borderLeft: "3px solid var(--blue)", backgroundColor: "var(--surface-3)", borderRadius: "0 6px 6px 0" }}>
                  <div style={{ fontSize: 11, color: "var(--blue)", fontWeight: 700, textTransform: "uppercase" }}>Action Plan Follow-up</div>
                  <p style={{ fontSize: 13, color: "var(--text)", marginTop: 4 }}>
                    {visit.coaching.actionPlan}
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* Merchandising Details Card */}
          <div className="card">
            <div className="card-header">
              <h3>🎨 Point of Sale & Merchandising Compliance</h3>
            </div>
            <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
                <span className={`badge badge-${visit.merchandising?.dispensersCleanAndFilled ? "approved" : "rejected"}`}>
                  Dispensers Clean/Filled: {visit.merchandising?.dispensersCleanAndFilled ? "Yes" : "No"}
                </span>
                <span className={`badge badge-${visit.merchandising?.posSignageVisible ? "approved" : "rejected"}`}>
                  POS Signage Visible: {visit.merchandising?.posSignageVisible ? "Yes" : "No"}
                </span>
                <span className={`badge badge-${visit.merchandising?.ticketInventoryAdequate ? "approved" : "rejected"}`}>
                  Inventory Adequate: {visit.merchandising?.ticketInventoryAdequate ? "Yes" : "No"}
                </span>
              </div>

              {visit.merchandising?.merchandisingFeedback && (
                <div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase" }}>Merchandising Feedback</div>
                  <p style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4, whiteSpace: "pre-wrap" }}>
                    {visit.merchandising.merchandisingFeedback}
                  </p>
                </div>
              )}
            </div>
          </div>

        </div>

      </div>

      {/* Equipment Audit Card - Spans full width at bottom */}
      <div className="card">
        <div className="card-header">
          <h3>⚙️ Equipment & Field Asset Audit Check</h3>
          <span className="badge badge-active">{visit.verifications.length} Audited items</span>
        </div>
        <div className="card-body" style={{ padding: 0 }}>
          {visit.verifications.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
              No physical equipment verification audit logged for this visit.
            </div>
          ) : (
            <table className="data-table">
              <thead>
                <tr>
                  <th>Equipment Category / Name</th>
                  <th>Model</th>
                  <th>Serial Number</th>
                  <th>Placement Zone</th>
                  <th>Observed Status</th>
                  <th>Audit Notes</th>
                </tr>
              </thead>
              <tbody>
                {visit.verifications.map((ver) => {
                  const assignment = ver.expectedAssignment;
                  const asset = assignment?.asset;
                  const type = asset?.type;

                  return (
                    <tr key={ver.id}>
                      <td>
                        <span style={{ fontWeight: 600, color: "var(--blue)", textTransform: "uppercase", fontSize: 11 }}>
                          {type?.category.replace(/_/g, " ")}
                        </span>
                        <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{type?.name}</div>
                      </td>
                      <td>{type?.model}</td>
                      <td style={{ fontFamily: "monospace" }}>{asset?.serialNumber || "—"}</td>
                      <td style={{ textTransform: "capitalize" }}>
                        {assignment?.placementZone.replace(/_/g, " ")}
                      </td>
                      <td>
                        <span className={`badge badge-${
                          ver.observedStatus === "present" ? "approved" : 
                          ver.observedStatus === "missing" ? "rejected" : "pending"
                        }`}>
                          {ver.observedStatus === "present" ? "🟢 Present" : 
                           ver.observedStatus === "missing" ? "🔴 Missing" : "🟡 Incorrect Placement"}
                        </span>
                        {ver.isDisputed && (
                          <div style={{ fontSize: 10, color: "var(--red)", marginTop: 4, fontWeight: 700 }}>
                            ⚠️ ASSIGNMENT DISPUTED
                          </div>
                        )}
                      </td>
                      <td style={{ fontSize: 12 }}>{ver.notes || <span className="muted">—</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

    </div>
  );
}
