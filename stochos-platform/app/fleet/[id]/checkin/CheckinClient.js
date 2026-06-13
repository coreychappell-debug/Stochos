"use client";

import { useState } from "react";
import { 
  Car, CheckCircle2, AlertTriangle, Gauge, 
  AlertCircle, ShieldAlert, ArrowLeft, Loader2 
} from "lucide-react";
import Link from "next/link";

export default function CheckinClient({ vehicle, currentUser }) {
  const [odometer, setOdometer] = useState("");
  const [type, setType] = useState("start");
  const [checkWalkaround, setCheckWalkaround] = useState(true);
  const [checkBrakes, setCheckBrakes] = useState(true);
  const [checkTires, setCheckTires] = useState(true);
  const [checkLights, setCheckLights] = useState(true);
  const [checkFluids, setCheckFluids] = useState(true);
  const [checkEngineLight, setCheckEngineLight] = useState(false);
  const [notes, setNotes] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [successData, setSuccessData] = useState(null);

  const parsedOdometer = parseInt(odometer);
  const odometerDiff = !isNaN(parsedOdometer) ? parsedOdometer - vehicle.mileage : 0;
  const isCatchUp = odometerDiff > 150; // flag catch-up if difference is > 150 miles

  const handleOdometerChange = (e) => {
    const val = e.target.value;
    if (val === "" || /^\d+$/.test(val)) {
      setOdometer(val);
      setError("");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (odometer === "") {
      setError("Please enter the current odometer reading.");
      return;
    }
    if (parsedOdometer < vehicle.mileage) {
      setError(`Odometer regression: entered mileage (${parsedOdometer}) cannot be less than the last recorded mileage (${vehicle.mileage}).`);
      return;
    }

    setSubmitting(true);
    setError("");

    try {
      const res = await fetch(`/api/fleet/${vehicle.id}/logs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          odometer: parsedOdometer,
          type,
          checkWalkaround,
          checkBrakes,
          checkTires,
          checkLights,
          checkFluids,
          checkEngineLight,
          notes
        })
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error || "Failed to submit check-in log.");
      }

      const log = await res.json();
      setSuccessData(log);
      setSubmitted(true);
    } catch (err) {
      setError(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div style={{
        minHeight: "100vh",
        background: "var(--surface-1)",
        padding: "24px 16px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        color: "var(--text)"
      }}>
        <div className="card" style={{ maxWidth: "450px", width: "100%", borderRadius: "12px", borderTop: "6px solid var(--gold)" }}>
          <div className="card-body" style={{ padding: "32px 24px", textAlign: "center" }}>
            <div style={{ display: "inline-flex", justifyContent: "center", color: "var(--gold)", marginBottom: "20px" }}>
              <CheckCircle2 size={64} />
            </div>
            <h2 style={{ fontSize: "22px", fontWeight: "800", marginBottom: "8px" }}>Check-in Logged</h2>
            <p style={{ color: "var(--text-secondary)", fontSize: "14px", marginBottom: "24px" }}>
              Pre-trip compliance checks registered successfully for license plate <strong>{vehicle.licensePlate}</strong>.
            </p>

            <div style={{ 
              background: "var(--surface-2)", 
              borderRadius: "8px", 
              padding: "16px", 
              textAlign: "left", 
              fontSize: "14px", 
              display: "flex", 
              flexDirection: "column", 
              gap: "8px", 
              marginBottom: "28px",
              border: "1px solid var(--border)"
            }}>
              <div><strong>License Plate:</strong> {vehicle.licensePlate}</div>
              <div><strong>Vehicle:</strong> {vehicle.year} {vehicle.make} {vehicle.model}</div>
              <div><strong>Odometer:</strong> {successData?.odometer.toLocaleString()} miles</div>
              <div><strong>Mileage Added:</strong> {odometerDiff.toLocaleString()} miles</div>
              <div><strong>Check-in Type:</strong> {type === "start" ? "Start of Shift" : type === "end" ? "End of Shift" : "Reconciliation / Post-Maintenance"}</div>
              <div><strong>Submitted By:</strong> {currentUser.name}</div>
              <div><strong>Engine Light Check:</strong> {checkEngineLight ? "⚠️ Active / Service Needed" : "✅ Clear"}</div>
            </div>

            <div style={{ display: "flex", gap: "12px" }}>
              <Link href="/" className="btn btn-secondary" style={{ flex: 1, padding: "12px", textAlign: "center", fontSize: "14px" }}>
                Dashboard
              </Link>
              <button 
                onClick={() => {
                  setOdometer("");
                  setSubmitted(false);
                  setSuccessData(null);
                }} 
                className="btn btn-primary" 
                style={{ flex: 1, padding: "12px", fontSize: "14px", backgroundColor: "var(--gold)", border: "none" }}
              >
                Log Another
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "var(--surface-1)",
      color: "var(--text)",
      display: "flex",
      flexDirection: "column"
    }}>
      {/* Mobile Header Bar */}
      <header style={{
        background: "var(--surface-2)",
        borderBottom: "1px solid var(--border)",
        padding: "16px 20px",
        display: "flex",
        alignItems: "center",
        gap: "12px",
        position: "sticky",
        top: 0,
        zIndex: 10
      }}>
        <Link href="/" style={{ color: "var(--text-secondary)" }}>
          <ArrowLeft size={20} />
        </Link>
        <div>
          <h1 style={{ fontSize: "16px", fontWeight: "800", margin: 0 }}>Compliance Check-in</h1>
          <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Plate: {vehicle.licensePlate}</span>
        </div>
      </header>

      {/* Main Form Body */}
      <main style={{ padding: "20px 16px", flex: 1, display: "flex", justifyContent: "center" }}>
        <form onSubmit={handleSubmit} style={{ maxWidth: "500px", width: "100%", display: "flex", flexDirection: "column", gap: "20px" }}>
          
          {/* Odometer Section */}
          <div className="card" style={{ borderRadius: "10px" }}>
            <div className="card-body" style={{ padding: "20px" }}>
              <h3 style={{ display: "flex", alignItems: "center", gap: "8px", margin: "0 0 16px 0", fontSize: "15px", fontWeight: "700" }}>
                <Gauge size={18} style={{ color: "var(--gold)" }} /> Odometer Reading
              </h3>
              
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", color: "var(--text-secondary)", marginBottom: "8px" }}>
                <span>Last Recorded Mileage:</span>
                <strong>{vehicle.mileage.toLocaleString()} miles</strong>
              </div>

              <div style={{ position: "relative" }}>
                <input 
                  type="text" 
                  inputMode="numeric"
                  pattern="[0-8]*"
                  value={odometer}
                  onChange={handleOdometerChange}
                  placeholder={`Enter mileage (>= ${vehicle.mileage})`}
                  style={{
                    width: "100%",
                    padding: "14px 16px",
                    borderRadius: "8px",
                    border: error ? "1px solid var(--red)" : "1px solid var(--border)",
                    background: "var(--surface-2)",
                    color: "var(--text)",
                    fontSize: "16px",
                    fontWeight: "600",
                    outline: "none"
                  }}
                />
              </div>

              {isCatchUp && (
                <div style={{ 
                  display: "flex", 
                  alignItems: "center", 
                  gap: "8px", 
                  backgroundColor: "rgba(245, 158, 11, 0.1)", 
                  border: "1px solid rgba(245, 158, 11, 0.3)", 
                  borderRadius: "8px", 
                  padding: "10px 12px", 
                  marginTop: "12px" 
                }}>
                  <AlertTriangle size={16} style={{ color: "rgb(245, 158, 11)", flexShrink: 0 }} />
                  <span style={{ fontSize: "12px", color: "var(--text-secondary)", lineHeight: "1.4" }}>
                    <strong>Catch-Up Log</strong>: You are logging a difference of {odometerDiff.toLocaleString()} miles since the last check. No intermediate logs are required.
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Settings / Checklist Section */}
          <div className="card" style={{ borderRadius: "10px" }}>
            <div className="card-body" style={{ padding: "20px" }}>
              <h3 style={{ margin: "0 0 16px 0", fontSize: "15px", fontWeight: "700" }}>Log Parameters</h3>
              
              <div style={{ marginBottom: "16px" }}>
                <label style={{ display: "block", fontSize: "12px", color: "var(--text-secondary)", marginBottom: "6px" }}>Check-in Type</label>
                <select 
                  value={type} 
                  onChange={(e) => setType(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "12px",
                    borderRadius: "6px",
                    border: "1px solid var(--border)",
                    background: "var(--surface-2)",
                    color: "var(--text)",
                    fontSize: "14px"
                  }}
                >
                  <option value="start">Start of Shift (Pre-Trip)</option>
                  <option value="end">End of Shift (Post-Trip)</option>
                  <option value="reconciliation">Reconciliation / Maintenance Sync</option>
                </select>
              </div>

              <h4 style={{ margin: "16px 0 10px 0", fontSize: "13px", fontWeight: "700", color: "var(--text-secondary)", borderBottom: "1px solid var(--border-dim)", paddingBottom: "6px" }}>
                DOT Checklist Compliance
              </h4>
              
              <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "8px" }}>
                
                <label style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", cursor: "pointer" }}>
                  <input 
                    type="checkbox" 
                    checked={checkWalkaround} 
                    onChange={(e) => setCheckWalkaround(e.target.checked)}
                    style={{ width: "18px", height: "18px", accentColor: "var(--gold)" }}
                  />
                  <span>Walkaround &amp; Exterior Lights Clear</span>
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", cursor: "pointer" }}>
                  <input 
                    type="checkbox" 
                    checked={checkBrakes} 
                    onChange={(e) => setCheckBrakes(e.target.checked)}
                    style={{ width: "18px", height: "18px", accentColor: "var(--gold)" }}
                  />
                  <span>Service &amp; Parking Brakes Operable</span>
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", cursor: "pointer" }}>
                  <input 
                    type="checkbox" 
                    checked={checkTires} 
                    onChange={(e) => setCheckTires(e.target.checked)}
                    style={{ width: "18px", height: "18px", accentColor: "var(--gold)" }}
                  />
                  <span>Tire Pressure &amp; Tread Inspected</span>
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", cursor: "pointer" }}>
                  <input 
                    type="checkbox" 
                    checked={checkLights} 
                    onChange={(e) => setCheckLights(e.target.checked)}
                    style={{ width: "18px", height: "18px", accentColor: "var(--gold)" }}
                  />
                  <span>Headlights, Signals, &amp; Mirrors Adjusted</span>
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", cursor: "pointer" }}>
                  <input 
                    type="checkbox" 
                    checked={checkFluids} 
                    onChange={(e) => setCheckFluids(e.target.checked)}
                    style={{ width: "18px", height: "18px", accentColor: "var(--gold)" }}
                  />
                  <span>Fluid Levels Check (Oil, Coolant, Washer)</span>
                </label>

                <label style={{ display: "flex", alignItems: "center", gap: "10px", fontSize: "14px", cursor: "pointer", color: checkEngineLight ? "var(--red)" : "inherit" }}>
                  <input 
                    type="checkbox" 
                    checked={checkEngineLight} 
                    onChange={(e) => setCheckEngineLight(e.target.checked)}
                    style={{ width: "18px", height: "18px", accentColor: "var(--red)" }}
                  />
                  <span>⚠️ Engine Check Light is ON / Alert Active</span>
                </label>
              </div>

              {/* Notes input */}
              <div style={{ marginTop: "16px" }}>
                <label style={{ display: "block", fontSize: "12px", color: "var(--text-secondary)", marginBottom: "6px" }}>Inspection Notes (Optional)</label>
                <textarea 
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Notes on paint wear, oil status, tires, etc."
                  style={{
                    width: "100%",
                    height: "80px",
                    padding: "10px 12px",
                    borderRadius: "6px",
                    border: "1px solid var(--border)",
                    background: "var(--surface-2)",
                    color: "var(--text)",
                    fontSize: "14px",
                    resize: "none",
                    outline: "none"
                  }}
                />
              </div>
            </div>
          </div>

          {error && (
            <div style={{ 
              display: "flex", 
              alignItems: "center", 
              gap: "8px", 
              backgroundColor: "rgba(185, 28, 28, 0.1)", 
              border: "1px solid rgba(185, 28, 28, 0.3)", 
              borderRadius: "8px", 
              padding: "12px", 
              color: "#b91c1c",
              fontSize: "13px"
            }}>
              <AlertCircle size={18} style={{ flexShrink: 0 }} />
              <span>{error}</span>
            </div>
          )}

          <button 
            type="submit" 
            disabled={submitting} 
            className="btn btn-primary"
            style={{ 
              width: "100%", 
              padding: "14px", 
              fontSize: "15px", 
              fontWeight: "700", 
              display: "flex", 
              justifyContent: "center", 
              alignItems: "center", 
              gap: "8px",
              backgroundColor: "var(--gold)",
              border: "none",
              cursor: submitting ? "not-allowed" : "pointer"
            }}
          >
            {submitting ? (
              <>
                <Loader2 className="animate-spin" size={18} /> Submitting...
              </>
            ) : (
              "Submit Compliance Log"
            )}
          </button>
        </form>
      </main>
    </div>
  );
}
