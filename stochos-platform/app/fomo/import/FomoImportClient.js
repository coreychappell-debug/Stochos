"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { FileText, Download, Search, Database, CheckCircle2, AlertTriangle, RefreshCw } from "lucide-react";

// CSV parsing utility
function parseCsvText(text) {
  const lines = [];
  let row = [""];
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    const next = text[i+1];
    if (c === '"') {
      if (inQuotes && next === '"') {
        row[row.length - 1] += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ',' && !inQuotes) {
      row.push('');
    } else if ((c === '\r' || c === '\n') && !inQuotes) {
      if (c === '\r' && next === '\n') {
        i++;
      }
      lines.push(row);
      row = [''];
    } else {
      row[row.length - 1] += c;
    }
  }
  if (row.length > 1 || row[0] !== '') {
    lines.push(row);
  }
  if (lines.length === 0) return [];
  
  const headers = lines[0].map(h => h.trim());
  const data = [];
  
  for (let i = 1; i < lines.length; i++) {
    const values = lines[i];
    if (values.length < headers.length) continue;
    const obj = {};
    headers.forEach((h, index) => {
      obj[h] = values[index];
    });
    data.push(obj);
  }
  return data;
}

export default function FomoImportClient({ routes = [], chains = [] }) {
  const router = useRouter();
  const [domain, setDomain] = useState("retailer_master");
  const [dryRun, setDryRun] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [fileName, setFileName] = useState("");
  const [parsedRows, setParsedRows] = useState([]);
  const [errors, setErrors] = useState([]);
  const [successResult, setSuccessResult] = useState(null);

  const [activeLocks, setActiveLocks] = useState([]);
  const isUploadingRef = useRef(false);

  const fetchActiveLocks = useCallback(async () => {
    try {
      const res = await fetch("/api/reporting/jobs");
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setActiveLocks(data.activeJobs || []);
        }
      }
    } catch (err) {
      console.error("Error fetching active locks:", err);
    }
  }, []);

  useEffect(() => {
    fetchActiveLocks();
    const interval = setInterval(fetchActiveLocks, 5000);
    return () => clearInterval(interval);
  }, [fetchActiveLocks]);

  // Prepopulated Template Generator State
  const [exportRouteId, setExportRouteId] = useState("all");
  const [exportChainId, setExportChainId] = useState("all");
  const [exportStatus, setExportStatus] = useState("all");

  const handleDownloadPrepopulatedTemplate = () => {
    const url = `/api/fomo/retailers/export?templateType=${domain}&routeId=${exportRouteId}&chainId=${exportChainId}&status=${exportStatus}`;
    window.location.href = url;
  };

  const handleDownloadTemplate = () => {
    let headers = [];
    let name = "";
    
    if (domain === "retailer_master") {
      headers = ["retailer_id", "retailer_name", "address_1", "city", "state", "postal_code", "phone", "status", "application_status", "training_status", "visit_cadence", "latitude", "longitude"];
      name = "retailer-master-template.csv";
    } else if (domain === "equipment_catalog") {
      headers = ["equipment_type_code", "equipment_category", "equipment_subtype", "vendor", "manufacturer", "model", "is_regulated"];
      name = "equipment-catalog-template.csv";
    } else if (domain === "equipment_assignment") {
      headers = ["retailer_id", "serial_number", "asset_tag", "equipment_category", "equipment_subtype", "vendor", "manufacturer", "model", "owner_type", "placement_zone", "source_system", "source_asset_key", "integration_mode", "network_required", "power_required", "supports_cashless", "supports_ticket_check", "supports_draw_games", "supports_instant_games", "install_date"];
      name = "equipment-assignment-template.csv";
    } else if (domain === "action_item") {
      headers = ["retailer_id", "title", "description", "due_date", "status"];
      name = "task-assignments-template.csv";
    }

    const blob = new Blob([headers.join(",") + "\n"], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.setAttribute("download", name);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    setSuccessResult(null);
    setErrors([]);
    
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const text = evt.target.result;
        const parsed = parseCsvText(text);
        setParsedRows(parsed);
      } catch (err) {
        setErrors([`Failed to parse local CSV: ${err.message}`]);
      }
    };
    reader.readAsText(file);
  };

  const handleImportSubmit = async () => {
    if (isUploadingRef.current) return;
    if (parsedRows.length === 0) {
      alert("Please upload a CSV file with data rows first.");
      return;
    }

    isUploadingRef.current = true;
    setUploading(true);
    setErrors([]);
    setSuccessResult(null);

    try {
      const res = await fetch(`/api/fomo/import?domain=${domain}&dryRun=${dryRun}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: parsedRows, fileName })
      });

      const data = await res.json();

      if (!res.ok) {
        if (data.details && Array.isArray(data.details)) {
          setErrors(data.details);
        } else {
          setErrors([data.error || "An unknown ingestion error occurred."]);
        }
        return;
      }

      setSuccessResult({
        dryRun: !!data.dryRun,
        message: data.message,
        created: data.createdCount,
        updated: data.updatedCount
      });

      if (!data.dryRun) {
        // Ingestion done!
        alert(`Ingestion complete! Created: ${data.createdCount}, Updated: ${data.updatedCount}`);
        router.refresh();
      }
      fetchActiveLocks();
    } catch (err) {
      setErrors([err.message]);
    } finally {
      isUploadingRef.current = false;
      setUploading(false);
    }
  };

  const expectedLockKey = `crm-import-${domain}`;
  const isCrmImportLocked = activeLocks.some(lock => lock.lockKey === expectedLockKey);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
      
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: 24, alignItems: "start" }}>
        
        {/* Import Configuration */}
        <div className="card">
          <div className="card-header">
            <h3>Import Options</h3>
          </div>
          <div className="card-body" style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            
            <div className="form-group">
              <label className="form-label">Upload Domain</label>
              <select
                className="form-select"
                value={domain}
                onChange={(e) => {
                  setDomain(e.target.value);
                  setParsedRows([]);
                  setFileName("");
                  setSuccessResult(null);
                  setErrors([]);
                }}
              >
                <option value="retailer_master">Retailer Master</option>
                <option value="equipment_catalog">Equipment Type Catalog</option>
                <option value="equipment_assignment">Equipment Assignments</option>
                <option value="action_item">Mass Task Assignments (Action Items)</option>
              </select>
            </div>

            <button className="btn btn-secondary" onClick={handleDownloadTemplate} style={{ width: "100%", justifyContent: "center", display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <FileText size={14} /> Download Blank Template
            </button>

            {/* Prepopulated Generator */}
            <div style={{ marginTop: 12, borderTop: "1px solid var(--border-color)", paddingTop: 12 }}>
              <h4 style={{ fontSize: 13, marginBottom: 8, color: "var(--text)" }}>Pre-populated Template Generator</h4>
              <p style={{ fontSize: 11, color: "var(--text-secondary)", marginBottom: 8 }}>
                Download a CSV pre-filled with matching retailer IDs and names based on filters below.
              </p>
              
              <div className="form-group" style={{ marginBottom: 8 }}>
                <label className="form-label" style={{ fontSize: 10, fontWeight: 700 }}>Filter Route</label>
                <select 
                  className="form-select" 
                  style={{ fontSize: 12, padding: "6px" }}
                  value={exportRouteId}
                  onChange={(e) => setExportRouteId(e.target.value)}
                >
                  <option value="all">All Routes</option>
                  {routes.map(r => <option key={r.id} value={r.id}>{r.code} — {r.name}</option>)}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 8 }}>
                <label className="form-label" style={{ fontSize: 10, fontWeight: 700 }}>Filter Chain</label>
                <select 
                  className="form-select" 
                  style={{ fontSize: 12, padding: "6px" }}
                  value={exportChainId}
                  onChange={(e) => setExportChainId(e.target.value)}
                >
                  <option value="all">All Chains</option>
                  {chains.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>

              <div className="form-group" style={{ marginBottom: 12 }}>
                <label className="form-label" style={{ fontSize: 10, fontWeight: 700 }}>Filter Store Status</label>
                <select 
                  className="form-select" 
                  style={{ fontSize: 12, padding: "6px" }}
                  value={exportStatus}
                  onChange={(e) => setExportStatus(e.target.value)}
                >
                  <option value="all">All Statuses</option>
                  <option value="active">Active Only</option>
                  <option value="warning">Warning Only</option>
                  <option value="suspended">Suspended Only</option>
                </select>
              </div>

              <button 
                type="button" 
                className="btn btn-secondary" 
                onClick={handleDownloadPrepopulatedTemplate}
                style={{ width: "100%", justifyContent: "center", fontSize: 12, backgroundColor: "var(--surface-3)", display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <Download size={14} /> Download Pre-populated CSV
              </button>
            </div>

            <div className="form-group" style={{ marginTop: 12, borderTop: "1px solid var(--border-color)", paddingTop: 12 }}>
              <label className="form-label">Select CSV File</label>
              <input
                type="file"
                accept=".csv"
                className="form-input"
                onChange={handleFileChange}
                style={{ padding: "8px" }}
              />
              {fileName && <p style={{ fontSize: 12, marginTop: 4, color: "var(--blue)" }}>File: {fileName}</p>}
            </div>

            <div className="form-group" style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <input
                type="checkbox"
                id="dryRunToggle"
                checked={dryRun}
                onChange={(e) => setDryRun(e.target.checked)}
                style={{ width: 16, height: 16, cursor: "pointer" }}
              />
              <label htmlFor="dryRunToggle" style={{ fontSize: 13, cursor: "pointer", fontWeight: 600 }}>
                Dry Run Mode (Validate only)
              </label>
            </div>

            {isCrmImportLocked && !dryRun && (
              <div style={{ padding: '12px', background: '#fffbeb', border: '1px solid #fef3c7', borderRadius: '8px', color: '#b45309', fontSize: '13px', fontWeight: '500', display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <AlertTriangle size={16} color="#b45309" />
                  <span>A database import is currently running on the server for {domain}. Direct imports are locked.</span>
                </div>
                {activeLocks.filter(l => l.lockKey === expectedLockKey).map(l => (
                  <div key={l.id} style={{ fontSize: '11px', color: '#78350f', background: 'rgba(217, 119, 6, 0.08)', padding: '6px 10px', borderRadius: '4px' }}>
                    Process: {l.description} | Started by: {l.userName} at {new Date(l.createdAt).toLocaleTimeString()}
                  </div>
                ))}
              </div>
            )}

            <button
              className="btn btn-primary"
              onClick={handleImportSubmit}
              disabled={uploading || parsedRows.length === 0 || (isCrmImportLocked && !dryRun)}
              style={{ width: "100%", justifyContent: "center", marginTop: 12, display: "inline-flex", alignItems: "center", gap: "6px", cursor: (uploading || parsedRows.length === 0 || (isCrmImportLocked && !dryRun)) ? "not-allowed" : "pointer" }}
            >
              {uploading ? (
                <>
                  <RefreshCw size={14} className="animate-spin" /> Ingesting...
                </>
              ) : dryRun ? (
                <>
                  <Search size={14} /> Dry Run Validation
                </>
              ) : (
                <>
                  <Database size={14} /> Execute Database Import
                </>
              )}
            </button>

          </div>
        </div>

        {/* Data Preview & Logs */}
        <div style={{ display: "flex", flexDirection: "column", gap: 24 }}>
          
          {/* Success Panel */}
          {successResult && (
            <div className="card" style={{ borderLeft: "4px solid var(--green)" }}>
              <div className="card-header">
                <h3 style={{ color: "var(--green)", display: "flex", alignItems: "center", gap: "6px" }}>
                  <CheckCircle2 size={18} /> Ingestion Report
                </h3>
              </div>
              <div className="card-body">
                {successResult.dryRun ? (
                  <div>
                    <h4 style={{ fontWeight: 600, color: "var(--green)" }}>Dry Run Successful</h4>
                    <p style={{ fontSize: 13, marginTop: 4 }}>{successResult.message}</p>
                    <p style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 6 }}>
                      Ready to import. Uncheck &quot;Dry Run Mode&quot; to commit changes to the PostgreSQL database.
                    </p>
                  </div>
                ) : (
                  <div>
                    <h4 style={{ fontWeight: 600, color: "var(--green)" }}>Ingestion Complete</h4>
                    <p style={{ fontSize: 13, marginTop: 4 }}>
                      Successfully updated the database registry.
                    </p>
                    <div style={{ display: "flex", gap: 16, marginTop: 8 }}>
                      <div style={{ fontSize: 13 }}>Created: <strong>{successResult.created}</strong></div>
                      <div style={{ fontSize: 13 }}>Updated: <strong>{successResult.updated}</strong></div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Validation Errors Panel */}
          {errors.length > 0 && (
            <div className="card" style={{ borderLeft: "4px solid var(--red)" }}>
              <div className="card-header">
                <h3 style={{ color: "var(--red)", display: "flex", alignItems: "center", gap: "6px" }}>
                  <AlertTriangle size={18} /> Ingestion Validation Errors ({errors.length})
                </h3>
              </div>
              <div className="card-body" style={{ maxHeight: 200, overflowY: "auto", display: "flex", flexDirection: "column", gap: 8 }}>
                {errors.map((err, idx) => (
                  <div key={idx} style={{ fontSize: 12, color: "var(--red)", fontFamily: "monospace", borderBottom: "1px solid var(--border-dim)", paddingBottom: 4 }}>
                    {err}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Parsed Rows Preview */}
          <div className="card">
            <div className="card-header">
              <h3>File Preview</h3>
              <span className="badge badge-submitted">{parsedRows.length} rows parsed</span>
            </div>
            <div className="card-body" style={{ padding: 0, maxHeight: 350, overflowY: "auto" }}>
              {parsedRows.length === 0 ? (
                <div style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>
                  Select a template and upload a CSV file to inspect the row structure.
                </div>
              ) : (
                <table className="data-table">
                  <thead>
                    <tr>
                      {Object.keys(parsedRows[0]).slice(0, 5).map(col => (
                        <th key={col}>{col}</th>
                      ))}
                      {Object.keys(parsedRows[0]).length > 5 && <th>...</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {parsedRows.slice(0, 10).map((row, rIdx) => (
                      <tr key={rIdx}>
                        {Object.values(row).slice(0, 5).map((val, cIdx) => (
                          <td key={cIdx} className="muted" style={{ maxWidth: 150, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {val}
                          </td>
                        ))}
                        {Object.keys(row).length > 5 && <td>...</td>}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}
