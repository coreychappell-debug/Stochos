"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useEffect } from "react";
import { CheckCircle2, AlertTriangle, Search, ClipboardList, MapPin, Calendar, FileText } from "lucide-react";

export default function FomoRetailerDetailClient({ retailer }) {
  const router = useRouter();
  const [resolving, setResolving] = useState(null);
  
  // Geodata verification state
  const [verifyData, setVerifyData] = useState(null);
  const [verifying, setVerifying] = useState(false);
  const [applying, setApplying] = useState(false);

  const checkAddress = async () => {
    setVerifying(true);
    try {
      const res = await fetch(`/api/fomo/retailers/${retailer.id}/verify-address`);
      if (!res.ok) throw new Error("Verification failed");
      const data = await res.json();
      setVerifyData(data);
    } catch (e) {
      console.error(e);
    } finally {
      setVerifying(false);
    }
  };

  useEffect(() => {
    checkAddress();
  }, [retailer.id]);

  const handleFlagCorrection = async () => {
    if (!verifyData || !verifyData.verified) return;
    
    setApplying(true);
    try {
      const res = await fetch(`/api/fomo/retailers/${retailer.id}/verify-address`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "flag-correction",
          address: verifyData.verifiedAddress,
          latitude: verifyData.verifiedCoords.lat,
          longitude: verifyData.verifiedCoords.lng
        })
      });

      if (!res.ok) throw new Error("Failed to flag correction request");
      alert("Retailer flagged for gaming host system update. The correction was added to the export queue.");
      router.refresh();
      checkAddress();
    } catch (e) {
      alert(e.message);
    } finally {
      setApplying(false);
    }
  };

  const handleBypassAddress = async () => {
    setApplying(true);
    try {
      const res = await fetch(`/api/fomo/retailers/${retailer.id}/verify-address`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "bypass" })
      });

      if (!res.ok) throw new Error("Failed to bypass coordinates");
      alert("Coordinates marked manually acceptable!");
      router.refresh();
      checkAddress();
    } catch (e) {
      alert(e.message);
    } finally {
      setApplying(false);
    }
  };

  const handleResolveException = async (excId) => {
    if (!confirm("Are you sure you want to resolve this equipment exception? This implies the mismatch is corrected.")) return;

    setResolving(excId);
    try {
      const res = await fetch(`/api/fomo/exceptions/${excId}/resolve`, {
        method: "POST"
      });

      if (!res.ok) throw new Error("Failed to resolve exception");
      
      alert("Exception marked as resolved.");
      router.refresh();
    } catch (err) {
      alert(err.message);
    } finally {
      setResolving(null);
    }
  };

  const openExceptions = retailer.discrepancies.filter(d => d.status === "open");
  const resolvedExceptions = retailer.discrepancies.filter(d => d.status === "resolved");

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      
      {/* Header Buttons */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
        <div>
          <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
            Retailer Profile
          </span>
          <h2 style={{ fontSize: 24, fontWeight: 800, color: "var(--text)", marginTop: 4 }}>{retailer.name}</h2>
          <p style={{ color: "var(--text-secondary)", fontSize: 13, marginTop: 2 }}>
            ID: {retailer.externalId} | {retailer.address}, {retailer.city}, NY {retailer.zipCode}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <Link href="/fomo/retailers" className="btn btn-secondary">
            ⬅ Back to Registry
          </Link>
          <Link href={`/fomo/visits/new?retailerId=${retailer.id}`} className="btn btn-primary" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
            <FileText size={14} /> Log Store Visit
          </Link>
        </div>
      </div>

      {/* Profile Metrics and Info Card */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 24, alignItems: "start" }}>
        
        {/* Profile Card */}
        <div className="card">
          <div className="card-header">
            <h3>Retailer Info</h3>
            <span className={`badge badge-${retailer.status}`}>{retailer.status}</span>
          </div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            <div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase" }}>Phone</div>
              <div style={{ fontWeight: 500 }}>{retailer.phone || "—"}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase" }}>Chain Association</div>
              <div style={{ fontWeight: 500 }}>{retailer.chain?.name || "Independent"}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase" }}>Assigned Route</div>
              <div style={{ fontWeight: 500, color: "var(--blue)" }}>{retailer.route?.code || "Unassigned"}</div>
              {retailer.route && <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{retailer.route.name} ({retailer.route.rep?.name})</div>}
            </div>
            <div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase" }}>Route Order Sequence</div>
              <div style={{ fontWeight: 500 }}>#{retailer.routeOrder}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase" }}>Visit Cadence</div>
              <div style={{ fontWeight: 500, textTransform: "capitalize" }}>{retailer.visitCadence}</div>
            </div>
            <div>
              <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase" }}>Coaching Status</div>
              <span className={`badge badge-${retailer.trainingStatus === "trained" ? "approved" : "draft"}`}>
                {retailer.trainingStatus === "trained" ? "Trained" : "Not Trained"}
              </span>
            </div>
            {retailer.lastVisitDate && (
              <div>
                <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase" }}>Last Rep Visit</div>
                <div style={{ fontWeight: 500 }}>{new Date(retailer.lastVisitDate).toLocaleDateString()}</div>
              </div>
            )}

            {/* Address Verification Panel */}
            <div style={{ marginTop: 12, borderTop: "1px solid var(--border-color)", paddingTop: 12 }}>
              <div style={{ fontSize: 10, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 6 }}>
                Address & Coordinates Audit
              </div>
              {verifying ? (
                <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>⏳ Querying US Census Geocoder...</div>
              ) : verifyData ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                  {verifyData.hostCorrectionRequested ? (
                    <div style={{ padding: 10, backgroundColor: "rgba(123, 104, 238, 0.08)", borderRadius: 4, borderLeft: "3px solid var(--purple)", display: "flex", flexDirection: "column", gap: 6 }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--purple)" }}>⏳ PENDING HOST UPDATE</span>
                      <p style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                        Standardized location has been flagged for gaming system update. Please enter these details in the host terminal record:
                      </p>
                      <div style={{ fontSize: 11, padding: 6, backgroundColor: "var(--surface-3)", borderRadius: 4, fontFamily: "monospace", color: "var(--text)" }}>
                        <strong>Address:</strong> {verifyData.verifiedAddress}<br />
                        <strong>Coords:</strong> ({verifyData.verifiedCoords?.lat?.toFixed(5)}, {verifyData.verifiedCoords?.lng?.toFixed(5)})
                      </div>
                    </div>
                  ) : verifyData.bypassed ? (
                    <div style={{ padding: 8, backgroundColor: "rgba(0, 123, 255, 0.08)", borderRadius: 4, borderLeft: "3px solid var(--blue)" }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "var(--blue)", display: "inline-flex", alignItems: "center", gap: "4px" }}><CheckCircle2 size={12} /> OVERRIDE APPROVED</span>
                      <p style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
                        Supervisor verified and approved stored coordinates manually (Bypassed).
                      </p>
                    </div>
                  ) : !verifyData.verified ? (
                    <div style={{ padding: 10, backgroundColor: "rgba(220, 53, 69, 0.08)", borderRadius: 4, borderLeft: "3px solid var(--red)", display: "flex", flexDirection: "column", gap: 6 }}>
                       <span style={{ fontSize: 11, fontWeight: 700, color: "var(--red)", display: "inline-flex", alignItems: "center", gap: "4px" }}><AlertTriangle size={12} /> UNMATCHED ADDRESS</span>
                      <p style={{ fontSize: 11, color: "var(--text-secondary)" }}>This address could not be verified by the USPS database.</p>
                      <button 
                        type="button"
                        className="btn btn-secondary btn-sm" 
                        style={{ width: "100%", justifyContent: "center", fontSize: 11, backgroundColor: "var(--surface-4)" }}
                        onClick={handleBypassAddress}
                        disabled={applying}
                      >
                        Approve Stored Coordinates Anyway
                      </button>
                    </div>
                  ) : !verifyData.coordsMatch ? (
                    <div style={{ padding: 10, backgroundColor: "rgba(255, 193, 7, 0.08)", borderRadius: 4, borderLeft: "3px solid var(--gold)", display: "flex", flexDirection: "column", gap: 8 }}>
                      <div>
                         <span style={{ fontSize: 11, fontWeight: 700, color: "var(--gold)", display: "inline-flex", alignItems: "center", gap: "4px" }}><AlertTriangle size={12} /> COORDINATES MISMATCH</span>
                        <p style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
                          Stored coordinates are off by <strong>{verifyData.distanceMeters} meters</strong> from official USPS geodata.
                        </p>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                        <button 
                          type="button"
                          className="btn btn-primary btn-sm" 
                          style={{ width: "100%", justifyContent: "center", fontSize: 11, backgroundColor: "var(--purple)", borderColor: "var(--purple)", color: "white" }}
                          onClick={handleFlagCorrection}
                          disabled={applying}
                        >
                          Flag for Gaming System Update
                        </button>
                        <button 
                          type="button"
                          className="btn btn-secondary btn-sm" 
                          style={{ width: "100%", justifyContent: "center", fontSize: 11, backgroundColor: "var(--surface-4)" }}
                          onClick={handleBypassAddress}
                          disabled={applying}
                        >
                          Approve Stored Coordinates (Bypass)
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ padding: 8, backgroundColor: "rgba(40, 167, 69, 0.08)", borderRadius: 4, borderLeft: "3px solid var(--green)" }}>
                       <span style={{ fontSize: 11, fontWeight: 700, color: "var(--green)", display: "inline-flex", alignItems: "center", gap: "4px" }}><CheckCircle2 size={12} /> COORDINATES VERIFIED</span>
                      <p style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>
                        Store matches USPS standard (Diff: {verifyData.distanceMeters}m).
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <button 
                  className="btn btn-secondary btn-sm"
                  style={{ width: "100%", justifyContent: "center", display: "inline-flex", alignItems: "center", gap: "6px" }}
                  onClick={checkAddress}
                >
                  <Search size={14} /> Run Geodata Audit
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Expected Equipment & Assets */}
        <div className="card">
          <div className="card-header">
            <h3 style={{ display: "flex", alignItems: "center", gap: "8px" }}><ClipboardList size={18} /> Expected Equipment & Collateral</h3>
            <span className="badge badge-submitted">{retailer.assignments.length} items</span>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {retailer.assignments.length === 0 ? (
              <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
                No equipment assignments registered for this retailer. Upload asset sheets in the importer.
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Asset Category</th>
                    <th>Model Name</th>
                    <th>Serial Number</th>
                    <th>Zone</th>
                    <th>Integration Source</th>
                    <th>Last Audited</th>
                  </tr>
                </thead>
                <tbody>
                  {retailer.assignments.map((asg) => (
                    <tr key={asg.id}>
                      <td>
                        <span style={{ fontWeight: 600, textTransform: "uppercase", fontSize: 11, color: "var(--blue)" }}>
                          {asg.asset?.type?.category.replace(/_/g, " ")}
                        </span>
                        <div style={{ fontSize: 10, color: "var(--text-secondary)" }}>{asg.asset?.type?.name}</div>
                      </td>
                      <td>{asg.asset?.type?.model}</td>
                      <td style={{ fontFamily: "monospace" }}>{asg.asset?.serialNumber || "—"}</td>
                      <td style={{ textTransform: "capitalize" }}>{asg.placementZone.replace(/_/g, " ")}</td>
                      <td className="muted" style={{ textTransform: "capitalize" }}>
                        {asg.sourceSystem.replace(/_/g, " ")}
                      </td>
                      <td className="muted">
                        {asg.lastVerifiedAt ? new Date(asg.lastVerifiedAt).toLocaleDateString() : "Never verified"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>

      {/* Discrepancy Exceptions */}
      {openExceptions.length > 0 && (
        <div className="card" style={{ borderLeft: "4px solid var(--red)" }}>
          <div className="card-header">
            <h3 style={{ color: "var(--red)", display: "flex", alignItems: "center", gap: "8px" }}><AlertTriangle size={18} /> Active Equipment Exceptions & Discrepancies</h3>
          </div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {openExceptions.map((ex) => (
              <div key={ex.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", backgroundColor: "var(--surface-3)", borderRadius: "6px" }}>
                <div>
                  <div style={{ fontWeight: 700, color: "var(--text)" }}>{ex.title}</div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>{ex.description}</div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 6 }}>Logged on {new Date(ex.createdAt).toLocaleDateString()} during store visit</div>
                </div>
                {/* Exception resolved button - for simulation, we can run a mock resolution or API resolution */}
                <button 
                  className="btn btn-secondary btn-sm"
                  onClick={() => handleResolveException(ex.id)}
                  disabled={resolving !== null}
                >
                  {resolving === ex.id ? "Resolving..." : "Mark Resolved"}
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Visits & Action Items Grid */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 24 }}>
        
        {/* Outstanding Action Items */}
        <div className="card">
          <div className="card-header">
            <h3 style={{ display: "flex", alignItems: "center", gap: "8px" }}><MapPin size={18} /> Route Action Items</h3>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {retailer.actionItems.length === 0 ? (
              <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
                No outstanding action items for this store.
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Action</th>
                    <th>Due Date</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {retailer.actionItems.map((item) => (
                    <tr key={item.id}>
                      <td>
                        <div style={{ fontWeight: 600 }}>{item.title}</div>
                        <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>{item.description}</div>
                      </td>
                      <td className="muted">{item.dueDate ? new Date(item.dueDate).toLocaleDateString() : "—"}</td>
                      <td>
                        <span className={`badge badge-${item.status === "completed" ? "approved" : "pending"}`}>
                          {item.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        {/* Visit logs history */}
        <div className="card">
          <div className="card-header">
            <h3 style={{ display: "flex", alignItems: "center", gap: "8px" }}><Calendar size={18} /> Visit Audits History</h3>
          </div>
          <div className="card-body" style={{ padding: 0 }}>
            {retailer.visits.length === 0 ? (
              <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
                No visits logged for this retailer yet.
              </div>
            ) : (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Visit Date</th>
                    <th>Representative</th>
                    <th>Coaching</th>
                    <th>Merch</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {retailer.visits.map((v) => (
                    <tr key={v.id}>
                      <td>{new Date(v.visitDate).toLocaleDateString()}</td>
                      <td>{v.user?.name}</td>
                      <td>
                        {v.coaching?.askForTheSaleTrained ? (
                          <span className="badge badge-approved">Trained</span>
                        ) : (
                          <span className="badge badge-draft">No</span>
                        )}
                      </td>
                      <td>
                        {v.merchandising?.dispensersCleanAndFilled && v.merchandising?.posSignageVisible ? (
                          <span className="badge badge-approved">Compliant</span>
                        ) : (
                          <span className="badge badge-rejected">Audit Alert</span>
                        )}
                      </td>
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

    </div>
  );
}
